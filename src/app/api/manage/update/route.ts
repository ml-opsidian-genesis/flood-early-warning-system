import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyManageToken } from "@/lib/manageToken";
import { sendSubscriptionConfirmation } from "@/lib/notify";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().min(1),
  locationIds: z.array(z.string()), // empty array = unsubscribe from all
});

/** POST /api/manage/update — replace a phone's subscriptions (token-authorised). */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { token, locationIds } = parsed.data;

  const phone = await verifyManageToken(token);
  if (!phone) {
    return NextResponse.json({ error: "Session expired — verify again" }, { status: 401 });
  }

  // Keep only IDs that actually exist.
  const validIds =
    locationIds.length === 0
      ? []
      : (
          await prisma.location.findMany({
            where: { id: { in: locationIds } },
            select: { id: true },
          })
        ).map((l) => l.id);

  if (validIds.length === 0) {
    // Unsubscribe from everything (keep the subscriber row, drop links).
    const subscriber = await prisma.subscriber.findUnique({ where: { phone } });
    if (subscriber) {
      await prisma.subscription.deleteMany({ where: { subscriberId: subscriber.id } });
    }
  } else {
    const subscriber = await prisma.subscriber.upsert({
      where: { phone },
      update: { verified: true },
      create: { phone, verified: true },
    });
    await prisma.$transaction([
      prisma.subscription.deleteMany({ where: { subscriberId: subscriber.id } }),
      prisma.subscription.createMany({
        data: validIds.map((locationId) => ({ subscriberId: subscriber.id, locationId })),
      }),
    ]);
  }

  await sendSubscriptionConfirmation(phone, validIds);

  return NextResponse.json({ ok: true, count: validIds.length });
}
