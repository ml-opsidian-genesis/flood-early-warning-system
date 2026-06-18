import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/predictions — every prediction the ml-model service has logged. */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [logs, bySource, total] = await Promise.all([
    prisma.predictionLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.predictionLog.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.predictionLog.count(),
  ]);

  const locationIds = [...new Set(logs.map((l) => l.locationId).filter((id): id is string => !!id))];
  const locations = locationIds.length
    ? await prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true, district: true },
      })
    : [];
  const locationMap = new Map(locations.map((l) => [l.id, l]));

  const counts = Object.fromEntries(bySource.map((s) => [s.source, s._count._all]));

  return NextResponse.json({
    predictions: logs.map((l) => ({
      id: l.id,
      source: l.source,
      modelVersion: l.modelVersion,
      locationName: l.locationId ? locationMap.get(l.locationId)?.name ?? null : null,
      district: l.locationId ? locationMap.get(l.locationId)?.district ?? null : null,
      input: l.input,
      score: l.score,
      riskLevel: l.riskLevel,
      confidence: l.confidence,
      createdAt: l.createdAt,
    })),
    counts,
    total,
  });
}
