import { mockFeatures, buildFeaturesFromRainfall, type WeatherRegime } from "@/lib/mockFeatures";
import { fetchRealRainfall } from "@/lib/weather";

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

/** Generate features for every location -- real rainfall from Open-Meteo
 *  where available, falling back to simulated rainfall per-location
 *  otherwise -- call the ml-model batch endpoint, and return both the API
 *  response and the locally-known weather regime per location (for
 *  persistence). */
export async function scoreLocations(
  locations: ScoreInputLocation[],
  dateISO: string,
): Promise<ScoreLocationsResult> {
  const weatherRegimes: WeatherRegimeMap = new Map();

  // Best-effort: a failed/partial fetch just means more locations fall
  // back to mock rainfall below -- never blocks scoring.
  const realRainfall = await fetchRealRainfall(
    locations.map((l) => ({ id: l.id, latitude: l.latitude, longitude: l.longitude })),
  );

  const payloadLocations = locations.map((l) => {
    const real = realRainfall.get(l.id);
    const { features, weatherRegime } = real
      ? buildFeaturesFromRainfall(l.id, l.district, dateISO, real.rainfall_7d_mm, real.monthly_rainfall_mm)
      : mockFeatures(l.id, l.district, dateISO);
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
