// Deterministic mock weather/feature generation, mirroring the deleted
// Python src/mock_features.py from the ml-model repo. Lives on the system
// side: the model API should only score fully-formed feature vectors, not
// simulate its own inputs.
//
// Individual fields can be swapped for real data (rainfall via Open-Meteo,
// elevation/river/hospital distance via src/lib/geo.ts) by passing a
// `real` overrides object to generateFeatures() -- any field left out
// falls back to the deterministic mock, so a partial or failed fetch
// degrades gracefully per-field, not all-or-nothing.

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRng(...parts: (string | number)[]): () => number {
  const key = parts.map(String).join("|");
  return mulberry32(xmur3(key)());
}

function choice<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function uniform(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function weightedChoice<T extends string>(
  rng: () => number,
  options: readonly T[],
  weights: readonly number[],
): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

const LANDCOVER = ["Urban", "Agriculture", "Forest", "Wetland", "Barren", "Grassland"] as const;
const SOIL = ["Clay", "Loamy", "Sandy", "Silt", "Peat"] as const;
const WATER_SUPPLY = ["Piped", "Municipal", "Well", "River"] as const;
const ELECTRICITY = ["Yes", "Mixed", "No"] as const;
const ROAD = ["Good (paved)", "Fair", "Poor (unpaved)", "No road access"] as const;
const REGIMES = ["dry", "normal", "wet", "storm"] as const;
export type WeatherRegime = (typeof REGIMES)[number];

/** Classify a real or simulated 7-day rainfall total into the same regime
 *  bands used to generate mock rainfall, so real data and mock data produce
 *  consistent downstream behavior (NDWI, inundation, flood flags). */
function regimeFromRainfall(rainfall: number): WeatherRegime {
  if (rainfall < 40) return "dry";
  if (rainfall < 95) return "normal";
  if (rainfall < 165) return "wet";
  return "storm";
}

type LocationProfile = {
  district: string;
  elevation_m: number;
  distance_to_river_m: number;
  drainage_index: number;
  historical_flood_count: number;
  landcover: string;
  soil_type: string;
  water_supply: string;
  electricity: string;
  road_quality: string;
  urban_rural: string;
  ndvi_base: number;
  population_density_per_km2: number;
  built_up_percent: number;
  infrastructure_score: number;
  nearest_hospital_km: number;
  nearest_evac_km: number;
};

function locationProfile(locId: string, district: string): LocationProfile {
  const rng = seededRng("profile", locId);
  const elevation = Math.round(uniform(rng, 2.0, 120.0) * 10) / 10;
  const urbanRural = rng() < 0.45 ? "Urban" : "Rural";
  const isUrban = urbanRural === "Urban";

  return {
    district,
    elevation_m: elevation,
    distance_to_river_m: Math.round(uniform(rng, 40.0, 4200.0) * 10) / 10,
    drainage_index: Math.round(uniform(rng, 0.15, 0.85) * 100) / 100,
    historical_flood_count: Math.floor(uniform(rng, 0, 10)),
    landcover: choice(rng, LANDCOVER),
    soil_type: choice(rng, SOIL),
    water_supply: choice(rng, WATER_SUPPLY),
    electricity: choice(rng, ELECTRICITY),
    road_quality: choice(rng, ROAD),
    urban_rural: urbanRural,
    ndvi_base: Math.round(uniform(rng, -0.2, 0.6) * 1000) / 1000,
    population_density_per_km2: Math.round(
      isUrban ? uniform(rng, 2000, 15000) : uniform(rng, 50, 2000),
    ),
    built_up_percent:
      Math.round((isUrban ? uniform(rng, 0.5, 0.95) : uniform(rng, 0.05, 0.5)) * 100) / 100,
    infrastructure_score: Math.round(uniform(rng, 0.2, 0.95) * 100) / 100,
    nearest_hospital_km: Math.round(uniform(rng, 0.5, 25) * 10) / 10,
    nearest_evac_km: Math.round(uniform(rng, 0.3, 15) * 10) / 10,
  };
}

export type MockFeatures = {
  rainfall_7d_mm: number;
  monthly_rainfall_mm: number;
  elevation_m: number;
  distance_to_river_m: number;
  drainage_index: number;
  ndwi: number;
  ndvi: number;
  historical_flood_count: number;
  inundation_area_sqm: number;
  district: string;
  landcover: string;
  soil_type: string;
  water_supply: string;
  electricity: string;
  road_quality: string;
  urban_rural: string;
  water_presence_flag: string;
  flood_occurrence_current_event: string;
  is_good_to_live: string;
  generation_date: string;
  population_density_per_km2: number;
  built_up_percent: number;
  infrastructure_score: number;
  nearest_hospital_km: number;
  nearest_evac_km: number;
};

export type MockFeaturesResult = {
  features: MockFeatures;
  weatherRegime: WeatherRegime;
};

/** Per-field real-data overrides. Any field left undefined falls back to
 *  the deterministic mock for that field -- a partial or fully-failed
 *  fetch degrades gracefully, not all-or-nothing. */
export type RealOverrides = {
  rainfall_7d_mm?: number;
  monthly_rainfall_mm?: number;
  elevation_m?: number;
  distance_to_river_m?: number;
  nearest_hospital_km?: number;
};

/** Deterministic per-(locationId, date) features, with any provided real
 *  values substituted in place of their mock equivalent. Rainfall drives
 *  the weather regime and every rainfall-dependent field (NDWI,
 *  inundation, flood flags); elevation also feeds into inundation/low-lying
 *  logic, so real values there change the same derived outputs a mock
 *  value would. */
export function generateFeatures(
  locationId: string,
  district: string,
  dateISO: string,
  real: RealOverrides = {},
): MockFeaturesResult {
  const prof = locationProfile(locationId, district);
  const rng = seededRng("daily", locationId, dateISO);

  let rainfall: number;
  let monthlyRainfall: number;
  if (real.rainfall_7d_mm !== undefined && real.monthly_rainfall_mm !== undefined) {
    rainfall = real.rainfall_7d_mm;
    monthlyRainfall = real.monthly_rainfall_mm;
  } else {
    const regime = weightedChoice(rng, REGIMES, [0.22, 0.4, 0.23, 0.15]);
    rainfall =
      regime === "dry" ? uniform(rng, 5, 40)
      : regime === "normal" ? uniform(rng, 40, 95)
      : regime === "wet" ? uniform(rng, 95, 165)
      : uniform(rng, 165, 320);
    monthlyRainfall = rainfall * uniform(rng, 2.5, 4.0);
  }

  const elevation = real.elevation_m ?? prof.elevation_m;
  const distanceToRiver = real.distance_to_river_m ?? prof.distance_to_river_m;
  const nearestHospital = real.nearest_hospital_km ?? prof.nearest_hospital_km;

  const regime = regimeFromRainfall(rainfall);
  const ndwi = Math.max(-1, Math.min(1, -0.2 + rainfall / 320 + uniform(rng, -0.15, 0.15)));
  const ndvi = Math.max(-1, Math.min(1, prof.ndvi_base + uniform(rng, -0.1, 0.1)));
  const inundation = Math.max(0, rainfall * uniform(rng, 60, 220) * (1 / (elevation + 5)));
  const lowLying = elevation < 25;
  const flooded = rainfall > 150 && (lowLying || prof.drainage_index < 0.4);

  const features: MockFeatures = {
    rainfall_7d_mm: Math.round(rainfall * 10) / 10,
    monthly_rainfall_mm: Math.round(monthlyRainfall * 10) / 10,
    elevation_m: elevation,
    distance_to_river_m: distanceToRiver,
    drainage_index: prof.drainage_index,
    ndwi: Math.round(ndwi * 1000) / 1000,
    ndvi: Math.round(ndvi * 1000) / 1000,
    historical_flood_count: prof.historical_flood_count,
    inundation_area_sqm: Math.round(inundation * 10) / 10,
    district: prof.district,
    landcover: prof.landcover,
    soil_type: prof.soil_type,
    water_supply: prof.water_supply,
    electricity: prof.electricity,
    road_quality: prof.road_quality,
    urban_rural: prof.urban_rural,
    water_presence_flag: ndwi > 0.1 ? "Likely" : "Unlikely",
    flood_occurrence_current_event: flooded ? "Yes" : "No",
    is_good_to_live: flooded ? "No" : "Yes",
    generation_date: dateISO,
    population_density_per_km2: prof.population_density_per_km2,
    built_up_percent: prof.built_up_percent,
    infrastructure_score: prof.infrastructure_score,
    nearest_hospital_km: nearestHospital,
    nearest_evac_km: prof.nearest_evac_km,
  };

  return { features, weatherRegime: regime };
}

/** Fully-mocked features, no real-data overrides. */
export function mockFeatures(
  locationId: string,
  district: string,
  dateISO: string,
): MockFeaturesResult {
  return generateFeatures(locationId, district, dateISO);
}
