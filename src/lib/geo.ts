// Real terrain/amenity data: elevation from Open-Elevation, nearest river
// and hospital distance from OpenStreetMap via the Overpass API. Both
// free, no API key. Best-effort throughout -- any failure just means
// those locations fall back to mockFeatures' simulated values for that
// field, never blocks scoring.
//
// One Overpass query covers every monitored location at once (a single
// bounding box around all of them), rather than one query per location --
// same batching principle as src/lib/weather.ts.

export type GeoOverrides = {
  elevation_m?: number;
  distance_to_river_m?: number;
  nearest_hospital_km?: number;
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchElevations(
  locations: { id: string; latitude: number; longitude: number }[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const res = await fetch("https://api.open-elevation.com/api/v1/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: locations.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
      }),
      cache: "no-store",
    });
    if (!res.ok) return result;
    const data = await res.json();
    const rows: { elevation?: number }[] = data?.results ?? [];
    rows.forEach((r, i) => {
      const loc = locations[i];
      if (loc && typeof r.elevation === "number") result.set(loc.id, r.elevation);
    });
  } catch {
    // Network error / API down -- elevation falls back to mock for everyone.
  }
  return result;
}

type OverpassPoint = { lat: number; lon: number };

async function overpassPoints(query: string): Promise<OverpassPoint[]> {
  try {
    // GET + a descriptive User-Agent: Overpass's reverse proxy returns 406
    // Not Acceptable for requests without one (its usage policy requires
    // client identification -- see https://wiki.openstreetmap.org/wiki/Overpass_API).
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": "FloodGuard/1.0 (ML Opsidian Genesis competition project)" },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    type Element = { lat?: number; lon?: number; center?: { lat: number; lon: number } };
    const elements: Element[] = data?.elements ?? [];
    return elements
      .map((e) => {
        if (typeof e.lat === "number" && typeof e.lon === "number") return { lat: e.lat, lon: e.lon };
        if (e.center) return { lat: e.center.lat, lon: e.center.lon };
        return null;
      })
      .filter((p): p is OverpassPoint => p !== null);
  } catch {
    return [];
  }
}

function boundingBox(locations: { latitude: number; longitude: number }[], paddingDeg = 0.2) {
  const lats = locations.map((l) => l.latitude);
  const lons = locations.map((l) => l.longitude);
  return {
    south: Math.min(...lats) - paddingDeg,
    west: Math.min(...lons) - paddingDeg,
    north: Math.max(...lats) + paddingDeg,
    east: Math.max(...lons) + paddingDeg,
  };
}

function nearestDistanceMeters(point: { latitude: number; longitude: number }, candidates: OverpassPoint[]): number | null {
  if (candidates.length === 0) return null;
  let min = Infinity;
  for (const c of candidates) {
    const d = haversineMeters(point.latitude, point.longitude, c.lat, c.lon);
    if (d < min) min = d;
  }
  return min;
}

/** Batched fetch: elevation (Open-Elevation) + nearest river and hospital
 *  distance (Overpass, one bounding-box query each covering every
 *  location). Returns a Map keyed by location id; any field a location
 *  couldn't get real data for is simply absent from its overrides object,
 *  so generateFeatures() falls back to mock for that field only. */
export async function fetchRealGeoFeatures(
  locations: { id: string; latitude: number; longitude: number }[],
): Promise<Map<string, GeoOverrides>> {
  const result = new Map<string, GeoOverrides>();
  if (locations.length === 0) return result;

  const bbox = boundingBox(locations);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const [elevations, hospitals, rivers] = await Promise.all([
    fetchElevations(locations),
    overpassPoints(`[out:json][timeout:25];node["amenity"="hospital"](${bboxStr});out center;`),
    overpassPoints(`[out:json][timeout:25];way["waterway"="river"](${bboxStr});out center;`),
  ]);

  for (const loc of locations) {
    const overrides: GeoOverrides = {};

    const elevation = elevations.get(loc.id);
    if (elevation !== undefined) overrides.elevation_m = Math.round(elevation * 10) / 10;

    const hospitalDist = nearestDistanceMeters(loc, hospitals);
    if (hospitalDist !== null) overrides.nearest_hospital_km = Math.round((hospitalDist / 1000) * 10) / 10;

    const riverDist = nearestDistanceMeters(loc, rivers);
    if (riverDist !== null) overrides.distance_to_river_m = Math.round(riverDist * 10) / 10;

    if (Object.keys(overrides).length > 0) result.set(loc.id, overrides);
  }

  return result;
}
