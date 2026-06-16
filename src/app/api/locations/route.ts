import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/locations — every location with its most recent risk score. */
export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    include: { scores: { orderBy: { scoredFor: "desc" }, take: 1 } },
  });

  const data = locations.map((loc) => {
    const latest = loc.scores[0];
    return {
      id: loc.id,
      name: loc.name,
      district: loc.district,
      latitude: loc.latitude,
      longitude: loc.longitude,
      score: latest?.score ?? null,
      riskLevel: latest?.riskLevel ?? null,
      weatherRegime: latest?.weatherRegime ?? null,
      scoredFor: latest?.scoredFor ?? null,
    };
  });

  return NextResponse.json({ locations: data });
}
