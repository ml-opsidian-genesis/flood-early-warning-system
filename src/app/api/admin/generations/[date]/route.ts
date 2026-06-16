import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { riskLevel } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/admin/generations/[date] — scores + feedback for one generation.
 *  `date` is YYYY-MM-DD (generations are stored at midnight UTC). */
export async function GET(_req: NextRequest, { params }: { params: { date: string } }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scoredFor = new Date(`${params.date}T00:00:00.000Z`);
  if (Number.isNaN(scoredFor.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [scores, feedbacks, thresholds] = await Promise.all([
    prisma.riskScore.findMany({
      where: { scoredFor },
      include: { location: { select: { name: true, district: true } } },
      orderBy: { score: "desc" },
    }),
    prisma.feedback.findMany({
      where: { scoredFor },
      include: { location: { select: { name: true, district: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getThresholds(),
  ]);

  const fbByLocation = new Map<string, number>();
  for (const f of feedbacks) fbByLocation.set(f.locationId, (fbByLocation.get(f.locationId) ?? 0) + 1);

  const summary = {
    total: feedbacks.length,
    floodedYes: feedbacks.filter((f) => f.actualFlooded === true).length,
    floodedNo: feedbacks.filter((f) => f.actualFlooded === false).length,
    accurate: feedbacks.filter((f) => f.accuracy === "accurate").length,
    overestimated: feedbacks.filter((f) => f.accuracy === "overestimated").length,
    underestimated: feedbacks.filter((f) => f.accuracy === "underestimated").length,
  };

  return NextResponse.json({
    date: params.date,
    thresholds,
    summary,
    scores: scores.map((s) => ({
      locationId: s.locationId,
      name: s.location.name,
      district: s.location.district,
      score: s.score,
      riskLevel: riskLevel(s.score, thresholds),
      weatherRegime: s.weatherRegime,
      features: s.features,
      feedbackCount: fbByLocation.get(s.locationId) ?? 0,
    })),
    feedbacks: feedbacks.map((f) => ({
      id: f.id,
      name: f.location.name,
      district: f.location.district,
      score: f.score,
      actualFlooded: f.actualFlooded,
      accuracy: f.accuracy,
      comment: f.comment,
      reporter: f.reporter,
      createdAt: f.createdAt,
    })),
  });
}
