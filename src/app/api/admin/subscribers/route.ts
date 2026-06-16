import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendSubscriptionConfirmation } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function guard() {
  try {
    await requireAdmin();
    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** GET /api/admin/subscribers — all subscribers with their subscriptions. */
export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const subscribers = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: {
        include: { location: { select: { id: true, name: true, district: true } } },
      },
    },
  });

  return NextResponse.json({
    subscribers: subscribers.map((s) => ({
      id: s.id,
      phone: s.phone,
      verified: s.verified,
      createdAt: s.createdAt,
      locationIds: s.subscriptions.map((sub) => sub.locationId),
      locations: s.subscriptions.map((sub) => ({
        id: sub.location.id,
        name: sub.location.name,
        district: sub.location.district,
      })),
    })),
  });
}

const PutBody = z.object({
  subscriberId: z.string().min(1),
  locationIds: z.array(z.string()),
});

/** PUT /api/admin/subscribers — admin replaces a subscriber's locations. */
export async function PUT(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const parsed = PutBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { subscriberId, locationIds } = parsed.data;

  const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
  if (!subscriber) {
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }

  const validIds = (
    await prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true } })
  ).map((l) => l.id);

  await prisma.$transaction([
    prisma.subscription.deleteMany({ where: { subscriberId } }),
    prisma.subscription.createMany({
      data: validIds.map((locationId) => ({ subscriberId, locationId })),
    }),
  ]);

  await sendSubscriptionConfirmation(subscriber.phone, validIds);

  return NextResponse.json({ ok: true, count: validIds.length });
}

/** DELETE /api/admin/subscribers?id=... — admin removes a subscriber entirely. */
export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const subscriber = await prisma.subscriber.findUnique({ where: { id } });
  if (!subscriber) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.subscriber.delete({ where: { id } }); // cascades subscriptions
  await sendSubscriptionConfirmation(subscriber.phone, []); // "unsubscribed" notice

  return NextResponse.json({ ok: true });
}
