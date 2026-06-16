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
  district: string;
  latitude: number;
  longitude: number;
  flood_risk_score: number;
  risk_level: string;
  weather_regime: string;
  features: Record<string, unknown>;
};

export type BatchScoreResponse = {
  model_version: string;
  scored_at: string;
  count: number;
  results: ScoredLocation[];
};

/** Call the ml-model FastAPI batch endpoint to score every location for a day. */
export async function scoreLocations(
  locations: ScoreInputLocation[],
  dateISO: string,
): Promise<BatchScoreResponse> {
  const res = await fetch(`${ML_SERVICE_URL}/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations, date: dateISO }),
    // Scoring runs server-side in a cron route; never cache.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ML service ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as BatchScoreResponse;
}
