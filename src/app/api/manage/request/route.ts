import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidPhone, startVerification } from "@/lib/twilio";

export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().trim() });

/** POST /api/manage/request — send an OTP so a user can manage their alerts. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !isValidPhone(parsed.data.phone)) {
    return NextResponse.json(
      { error: "Enter a valid phone number, e.g. +94771234567" },
      { status: 400 },
    );
  }
  try {
    const { simulated } = await startVerification(parsed.data.phone);
    return NextResponse.json({ ok: true, simulated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send code" },
      { status: 502 },
    );
  }
}
