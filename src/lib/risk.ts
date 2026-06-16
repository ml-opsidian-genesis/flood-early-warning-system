export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";

/** Admin-configurable thresholds. A score is bucketed by the level boundaries;
 *  alerts fire at/above `alertThreshold`. All values are in 0..1. */
export type Thresholds = {
  moderateMin: number; // score >= this  -> at least Moderate
  highMin: number; //     score >= this  -> at least High
  criticalMin: number; // score >= this  -> Critical
  alertThreshold: number; // score >= this -> send an alert
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  moderateMin: 0.25,
  highMin: 0.5,
  criticalMin: 0.75,
  alertThreshold: 0.5,
};

/** Bucket a continuous 0..1 score into a risk level using the given thresholds. */
export function riskLevel(score: number, t: Thresholds = DEFAULT_THRESHOLDS): RiskLevel {
  if (score >= t.criticalMin) return "Critical";
  if (score >= t.highMin) return "High";
  if (score >= t.moderateMin) return "Moderate";
  return "Low";
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Low: "#22c55e",
  Moderate: "#eab308",
  High: "#f97316",
  Critical: "#dc2626",
};

export function riskColor(score: number, t: Thresholds = DEFAULT_THRESHOLDS): string {
  return RISK_COLORS[riskLevel(score, t)];
}
