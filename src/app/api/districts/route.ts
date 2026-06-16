import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { riskLevel } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/districts — latest-day risk aggregated per district (for the choropleth).
 *  Public, like /api/locations. A district's score is the mean of its locations. */
export async function GET() {
  const [latest, thresholds] = await Promise.all([
    prisma.riskScore.findFirst({ orderBy: { scoredFor: "desc" }, select: { scoredFor: true } }),
    getThresholds(),
  ]);

  if (!latest) {
    return NextResponse.json({ districts: [], thresholds });
  }

  const rows = await prisma.riskScore.findMany({
    where: { scoredFor: latest.scoredFor },
    select: { score: true, location: { select: { district: true } } },
  });

  const byDistrict = new Map<string, number[]>();
  for (const r of rows) {
    const d = r.location.district;
    (byDistrict.get(d) ?? byDistrict.set(d, []).get(d)!).push(r.score);
  }

  const districts = Array.from(byDistrict.entries()).map(([district, scores]) => {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return {
      district,
      score: avg,
      level: riskLevel(avg, thresholds),
      count: scores.length,
    };
  });

  return NextResponse.json({ districts, thresholds, scoredFor: latest.scoredFor });
}
