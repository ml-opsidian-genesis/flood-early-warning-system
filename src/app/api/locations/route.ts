import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { riskLevel } from "@/lib/risk";
import { getThresholds } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET /api/locations — every location with its most recent risk score.
 *  Risk level is computed from the current admin thresholds, so changing
 *  thresholds reclassifies the map immediately (no re-run needed). */
export async function GET() {
  const [locations, thresholds] = await Promise.all([
    prisma.location.findMany({
      orderBy: { name: "asc" },
      include: { scores: { orderBy: { scoredFor: "desc" }, take: 1 } },
    }),
    getThresholds(),
  ]);

  const data = locations.map((loc) => {
    const latest = loc.scores[0];
    const score = latest?.score ?? null;
    return {
      id: loc.id,
      name: loc.name,
      district: loc.district,
      latitude: loc.latitude,
      longitude: loc.longitude,
      score,
      riskLevel: score != null ? riskLevel(score, thresholds) : null,
      weatherRegime: latest?.weatherRegime ?? null,
      scoredFor: latest?.scoredFor ?? null,
    };
  });

  return NextResponse.json({ locations: data, thresholds });
}
