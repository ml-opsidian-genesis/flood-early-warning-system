import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidPhone, startVerification } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().trim(),
  locationIds: z.array(z.string()).min(1, "Select at least one location"),
});

/** POST /api/subscribe — validate request and send an OTP to the phone. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { phone, locationIds } = parsed.data;

  if (!isValidPhone(phone)) {
    return NextResponse.json(
      { error: "Enter a valid phone number in E.164 format, e.g. +94771234567" },
      { status: 400 },
    );
  }

  // Ensure every selected location actually exists.
  const count = await prisma.location.count({ where: { id: { in: locationIds } } });
  if (count !== locationIds.length) {
    return NextResponse.json({ error: "One or more locations are invalid" }, { status: 400 });
  }

  try {
    const { simulated } = await startVerification(phone);
    return NextResponse.json({ ok: true, simulated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send OTP" },
      { status: 502 },
    );
  }
}
