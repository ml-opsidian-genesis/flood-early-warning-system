import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/stats — lightweight monitoring snapshot for the dashboard. */
export async function GET() {
  const [subscribers, subscriptions, alertsSent, lastRun, latestScore] = await Promise.all([
    prisma.subscriber.count({ where: { verified: true } }),
    prisma.subscription.count(),
    prisma.alert.count({ where: { status: { in: ["sent", "simulated"] } } }),
    prisma.scoringRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.riskScore.findFirst({ orderBy: { scoredFor: "desc" }, select: { scoredFor: true } }),
  ]);

  let distribution: Record<string, number> = {};
  if (latestScore) {
    const grouped = await prisma.riskScore.groupBy({
      by: ["riskLevel"],
      where: { scoredFor: latestScore.scoredFor },
      _count: { _all: true },
    });
    distribution = Object.fromEntries(grouped.map((g) => [g.riskLevel, g._count._all]));
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
