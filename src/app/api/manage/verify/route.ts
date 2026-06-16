import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkVerification, isValidPhone } from "@/lib/twilio";
import { signManageToken } from "@/lib/manageToken";

export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().trim(),
  code: z.string().trim().min(4),
});

/** POST /api/manage/verify — check OTP, return a manage token + current subscriptions. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { phone, code } = parsed.data;

  const approved = await checkVerification(phone, code);
  if (!approved) {
    return NextResponse.json({ error: "Incorrect or expired code" }, { status: 400 });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { phone },
    include: { subscriptions: { select: { locationId: true } } },
  });

  const token = await signManageToken(phone);
  return NextResponse.json({
    ok: true,
    token,
    locationIds: subscriber?.subscriptions.map((s) => s.locationId) ?? [],
  });
}
