import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [alerts, byStatus, total] = await Promise.all([
    prisma.alert.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.alert.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.alert.count(),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));

  return NextResponse.json({ alerts, counts, total });
}
