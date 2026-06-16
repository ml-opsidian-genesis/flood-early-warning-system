import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rough Sri Lanka bounding box — catches swapped/typo'd coordinates.
const LAT = z.number().min(5.5).max(10.5);
const LON = z.number().min(79).max(82.5);

const CreateBody = z.object({
  name: z.string().trim().min(1, "Name is required"),
  district: z.string().trim().min(1, "District is required"),
  latitude: LAT,
  longitude: LON,
});

/** GET /api/admin/locations — all locations with their latest score (admin view). */
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await prisma.location.findMany({
    orderBy: [{ district: "asc" }, { name: "asc" }],
    include: {
      scores: { orderBy: { scoredFor: "desc" }, take: 1 },
      _count: { select: { subscriptions: true } },
    },
  });

  return NextResponse.json({
    locations: locations.map((l) => {
      const latest = l.scores[0];
      return {
        id: l.id,
        name: l.name,
        district: l.district,
        latitude: l.latitude,
        longitude: l.longitude,
        subscribers: l._count.subscriptions,
        score: latest?.score ?? null,
        riskLevel: latest?.riskLevel ?? null,
        weatherRegime: latest?.weatherRegime ?? null,
        scoredFor: latest?.scoredFor ?? null,
      };
    }),
  });
}

/** POST /api/admin/locations — add a new monitored place. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const loc = await prisma.location.create({ data: parsed.data });
    return NextResponse.json({ ok: true, location: loc }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A location with this name already exists in that district" },
        { status: 409 },
      );
    }
    throw e;
  }
}

/** DELETE /api/admin/locations?id=... — remove a place (cascades scores + subs). */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }
}
