import { prisma } from "./prisma";
import { DEFAULT_THRESHOLDS, type Thresholds } from "./risk";

const SINGLETON = "singleton";

/** Current thresholds from the DB, falling back to defaults if unset. */
export async function getThresholds(): Promise<Thresholds> {
  const s = await prisma.settings.findUnique({ where: { id: SINGLETON } });
  if (!s) return DEFAULT_THRESHOLDS;
  return {
    moderateMin: s.moderateMin,
    highMin: s.highMin,
    criticalMin: s.criticalMin,
    alertThreshold: s.alertThreshold,
  };
}

/** Validate ordering and persist new thresholds. Throws on invalid input. */
export async function saveThresholds(t: Thresholds): Promise<Thresholds> {
  const vals = [t.moderateMin, t.highMin, t.criticalMin, t.alertThreshold];
  if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
    throw new Error("All thresholds must be between 0 and 1");
  }
  if (!(t.moderateMin < t.highMin && t.highMin < t.criticalMin)) {
    throw new Error("Thresholds must increase: moderate < high < critical");
  }

  await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: t,
    create: { id: SINGLETON, ...t },
  });
  return t;
}
