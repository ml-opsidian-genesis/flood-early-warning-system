export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

/** Bucket a continuous 0..1 score into a risk level (matches the ML service). */
export function riskLevel(score: number): RiskLevel {
  if (score < 0.25) return "Low";
  if (score < 0.5) return "Moderate";
  if (score < 0.75) return "High";
  return "Critical";
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#f97316",
  Critical: "#dc2626",
};

export function riskColor(score: number): string {
  return RISK_COLORS[riskLevel(score)];
}

/** Score at/above which an alert is sent. Configurable via ALERT_THRESHOLD. */
export function alertThreshold(): number {
  const v = Number(process.env.ALERT_THRESHOLD);
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.55;
}
