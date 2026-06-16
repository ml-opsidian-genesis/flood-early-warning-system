import { prisma } from "@/lib/prisma";
import { scoreLocations } from "@/lib/scoring";
import { riskLevel } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";
import { sendWhatsApp } from "@/lib/twilio";

export type PipelineSummary = {
  ok: boolean;
  scoredFor: string;
  threshold: number;
  locationsScored: number;
  highRiskCount: number;
  alertsSent: number;
  highRisk: { name: string; district: string; score: number; level: string }[];
};

function alertMessage(name: string, district: string, level: string, score: number): string {
  return (
    `🚨 *FloodGuard Alert*\n\n` +
    `${name}, ${district} is at *${level}* flood risk today ` +
    `(score ${score.toFixed(2)}).\n\n` +
    `Please stay alert, avoid low-lying areas near rivers, and follow local ` +
    `disaster-management advisories.\n\n_You subscribed to alerts for ${name}._`
  );
}

/** The FloodGuard morning pipeline: score all locations, persist, alert subscribers. */
export async function runScoringPipeline(): Promise<PipelineSummary> {
  const dateISO = new Date().toISOString().slice(0, 10);
  const scoredFor = new Date(`${dateISO}T00:00:00.000Z`);
  const thresholds = await getThresholds();
  const threshold = thresholds.alertThreshold;

  const locations = await prisma.location.findMany();
  if (locations.length === 0) {
    throw new Error("No locations seeded. Run `npm run db:seed`.");
  }

  let batch;
  try {
    batch = await scoreLocations(
      locations.map((l) => ({
        id: l.id,
        name: l.name,
        district: l.district,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
      dateISO,
    );
  } catch (e) {
    await prisma.scoringRun.create({
      data: {
        scoredFor,
        locationCount: locations.length,
        status: "failed",
        detail: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
  }

  // Persist today's scores (idempotent for re-runs / live demos).
  await prisma.riskScore.deleteMany({ where: { scoredFor } });
  await prisma.riskScore.createMany({
    data: batch.results.map((r) => ({
      locationId: r.id,
      score: r.flood_risk_score,
      riskLevel: riskLevel(r.flood_risk_score, thresholds),
      weatherRegime: r.weather_regime,
      features: r.features as object,
      scoredFor,
    })),
  });

  // Alert subscribers of every high-risk location.
  const highRisk = batch.results.filter((r) => r.flood_risk_score >= threshold);
  let alertsSent = 0;

  for (const loc of highRisk) {
    const subs = await prisma.subscription.findMany({
      where: { locationId: loc.id, subscriber: { verified: true } },
      include: { subscriber: true },
    });

    for (const sub of subs) {
      const level = riskLevel(loc.flood_risk_score, thresholds);
      const result = await sendWhatsApp(
        sub.subscriber.phone,
        alertMessage(loc.name, loc.district, level, loc.flood_risk_score),
      );
      if (result.status === "sent" || result.status === "simulated") alertsSent += 1;

      await prisma.alert.create({
        data: {
          subscriberId: sub.subscriberId,
          phone: sub.subscriber.phone,
          locationName: loc.name,
          district: loc.district,
          score: loc.flood_risk_score,
          riskLevel: level,
          status: result.status,
          detail: result.detail,
        },
      });
    }
  }

  await prisma.scoringRun.create({
    data: {
      scoredFor,
      locationCount: batch.results.length,
      alertsSent,
      highRiskCount: highRisk.length,
      modelVersion: batch.model_version,
      status: "success",
    },
  });

  return {
    ok: true,
    scoredFor: dateISO,
    threshold,
    locationsScored: batch.results.length,
    highRiskCount: highRisk.length,
    alertsSent,
    highRisk: highRisk.map((r) => ({
      name: r.name,
      district: r.district,
      score: Number(r.flood_risk_score.toFixed(4)),
      level: riskLevel(r.flood_risk_score, thresholds),
    })),
  };
}
