// Real rainfall from Open-Meteo (free, no API key, no signup --
// https://open-meteo.com). Best-effort: any failure (network, bad
// response, location not covered) just means that location falls back to
// mockFeatures()'s simulated rainfall -- never throws, never blocks scoring.

export type RealRainfall = {
  rainfall_7d_mm: number;
  monthly_rainfall_mm: number;
};

type OpenMeteoResponse = {
  daily?: {
    precipitation_sum?: (number | null)[];
  };
};

/** Batched fetch: one HTTP call covers every location (Open-Meteo accepts
 *  comma-separated lat/lon lists and returns one result object per
 *  location, same order as the input). Returns a Map keyed by location id;
 *  locations that fail or have no data are simply absent, so callers can
 *  fall back to mock rainfall per-location. */
export async function fetchRealRainfall(
  locations: { id: string; latitude: number; longitude: number }[],
): Promise<Map<string, RealRainfall>> {
  const result = new Map<string, RealRainfall>();
  if (locations.length === 0) return result;

  const lats = locations.map((l) => l.latitude).join(",");
  const lons = locations.map((l) => l.longitude).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=UTC`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return result;

    const data: unknown = await res.json();
    const perLocation: OpenMeteoResponse[] = Array.isArray(data) ? data : [data as OpenMeteoResponse];

    perLocation.forEach((entry, i) => {
      const loc = locations[i];
      const daily = entry?.daily?.precipitation_sum;
      if (!loc || !daily || daily.length === 0) return;

      const clean = daily.map((v) => v ?? 0);
      const last7 = clean.slice(-7);
      result.set(loc.id, {
        rainfall_7d_mm: Math.round(last7.reduce((a, b) => a + b, 0) * 10) / 10,
        monthly_rainfall_mm: Math.round(clean.reduce((a, b) => a + b, 0) * 10) / 10,
      });
    });
  } catch {
    // Network error, API down, etc. -- every location falls back to mock rainfall.
  }

  return result;
}
