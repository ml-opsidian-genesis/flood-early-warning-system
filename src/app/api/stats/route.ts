import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { riskLevel } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/stats — lightweight monitoring snapshot for the dashboard. */
export async function GET() {
  const [subscribers, subscriptions, alertsSent, lastRun, latestScore, thresholds] =
    await Promise.all([
      prisma.subscriber.count({ where: { verified: true } }),
      prisma.subscription.count(),
      prisma.alert.count({ where: { status: { in: ["sent", "simulated"] } } }),
      prisma.scoringRun.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.riskScore.findFirst({ orderBy: { scoredFor: "desc" }, select: { scoredFor: true } }),
      getThresholds(),
    ]);

  // Recompute the distribution from raw scores against the current thresholds.
  const distribution: Record<string, number> = {};
  if (latestScore) {
    const scores = await prisma.riskScore.findMany({
      where: { scoredFor: latestScore.scoredFor },
      select: { score: true },
    });
    for (const { score } of scores) {
      const level = riskLevel(score, thresholds);
      distribution[level] = (distribution[level] ?? 0) + 1;
    }
  }

  const recentAlerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      phone: true, locationName: true, district: true,
      score: true, riskLevel: true, status: true, createdAt: true,
    },
  });

  return NextResponse.json({
    subscribers,
    subscriptions,
    alertsSent,
    lastRun,
    distribution,
    recentAlerts: recentAlerts.map((a) => ({
      ...a,
      phone: a.phone.replace(/(\+\d{3})\d+(\d{2})/, "$1•••••$2"), // mask
    })),
  });
}
