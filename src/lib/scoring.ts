import { generateFeatures, type RealOverrides, type WeatherRegime } from "@/lib/mockFeatures";
import { fetchRealRainfall } from "@/lib/weather";
import { fetchRealGeoFeatures } from "@/lib/geo";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";

export type ScoreInputLocation = {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
};

export type ScoredLocation = {
  id: string;
  name: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  flood_risk_score: number;
  risk_level: string;
  confidence: string;
  features: Record<string, unknown>;
};

export type BatchScoreResponse = {
  model_version: string;
  scored_at: string;
  count: number;
  results: ScoredLocation[];
};

/** Locally generated per-location weather regime, keyed by location id.
 *  The model has no concept of "regime" -- this is retained client-side
 *  so callers can persist it without an echo from the API. */
export type WeatherRegimeMap = Map<string, WeatherRegime>;

export type ScoreLocationsResult = {
  batch: BatchScoreResponse;
  weatherRegimes: WeatherRegimeMap;
};

/** Generate features for every location -- real rainfall (Open-Meteo) and
 *  real elevation/river/hospital distance (OpenStreetMap, see
 *  src/lib/geo.ts) where available, falling back to simulated values
 *  per-field otherwise -- call the ml-model batch endpoint, and return
 *  both the API response and the locally-known weather regime per
 *  location (for persistence). */
export async function scoreLocations(
  locations: ScoreInputLocation[],
  dateISO: string,
): Promise<ScoreLocationsResult> {
  const weatherRegimes: WeatherRegimeMap = new Map();
  const locationRefs = locations.map((l) => ({ id: l.id, latitude: l.latitude, longitude: l.longitude }));

  // Best-effort, run in parallel: a failed/partial fetch from either just
  // means more fields fall back to mock per-location -- never blocks scoring.
  const [realRainfall, realGeo] = await Promise.all([
    fetchRealRainfall(locationRefs),
    fetchRealGeoFeatures(locationRefs),
  ]);

  const payloadLocations = locations.map((l) => {
    const rainfall = realRainfall.get(l.id);
    const geo = realGeo.get(l.id);
    const real: RealOverrides = { ...rainfall, ...geo };

    const { features, weatherRegime } = generateFeatures(l.id, l.district, dateISO, real);
    weatherRegimes.set(l.id, weatherRegime);
    return {
      id: l.id,
      name: l.name,
      latitude: l.latitude,
      longitude: l.longitude,
      ...features,
    };
  });

  const res = await fetch(`${ML_SERVICE_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations: payloadLocations }),
    // Scoring runs server-side in a cron route; never cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML service ${res.status}: ${text.slice(0, 300)}`);
  }
  const batch = (await res.json()) as BatchScoreResponse;
  return { batch, weatherRegimes };
}
