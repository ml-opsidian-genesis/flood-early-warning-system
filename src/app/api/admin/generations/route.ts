import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/generations — one row per pipeline generation (scoredFor). */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [gens, feedbackGroups, runs] = await Promise.all([
    prisma.riskScore.groupBy({
      by: ["scoredFor"],
      _count: { _all: true },
      _avg: { score: true },
      orderBy: { scoredFor: "desc" },
    }),
    prisma.feedback.groupBy({ by: ["scoredFor"], _count: { _all: true } }),
    prisma.scoringRun.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const fbMap = new Map(feedbackGroups.map((f) => [f.scoredFor.toISOString(), f._count._all]));
  const runMap = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    const k = r.scoredFor.toISOString();
    if (!runMap.has(k)) runMap.set(k, r); // first = most recent (ordered desc)
  }

  const generations = gens.map((g) => {
    const iso = g.scoredFor.toISOString();
    const run = runMap.get(iso);
    return {
      date: iso.slice(0, 10),
      scoredFor: iso,
      locationCount: g._count._all,
      avgScore: g._avg.score ?? 0,
      feedbackCount: fbMap.get(iso) ?? 0,
      alertsSent: run?.alertsSent ?? 0,
      highRiskCount: run?.highRiskCount ?? 0,
      modelVersion: run?.modelVersion ?? null,
      ranAt: run?.createdAt ?? null,
    };
  });

  return NextResponse.json({ generations });
}
