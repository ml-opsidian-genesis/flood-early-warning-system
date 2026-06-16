import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkVerification, isValidPhone } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().trim(),
  code: z.string().trim().min(4),
  locationIds: z.array(z.string()).min(1),
});

/** POST /api/verify — check OTP, then create the verified subscriber + subscriptions. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { phone, code, locationIds } = parsed.data;

  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const approved = await checkVerification(phone, code);
  if (!approved) {
    return NextResponse.json({ error: "Incorrect or expired code" }, { status: 400 });
  }

  const validIds = (
    await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true },
    })
  ).map((l) => l.id);

  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid locations selected" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.upsert({
    where: { phone },
    update: { verified: true },
    create: { phone, verified: true },
  });

  await prisma.$transaction(
    validIds.map((locationId) =>
      prisma.subscription.upsert({
        where: { subscriberId_locationId: { subscriberId: subscriber.id, locationId } },
        update: {},
        create: { subscriberId: subscriber.id, locationId },
      }),
    ),
  );

  return NextResponse.json({ ok: true, subscribedCount: validIds.length });
}
