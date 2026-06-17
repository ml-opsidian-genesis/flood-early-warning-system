import twilio from "twilio";
import { prisma } from "@/lib/prisma";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

/** True when real Twilio credentials are configured. */
export const twilioEnabled = Boolean(SID && TOKEN && WHATSAPP_FROM);

const client = twilioEnabled ? twilio(SID, TOKEN) : null;

/** Basic E.164 check (e.g. +94771234567). */
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export type WhatsAppResult = { status: "sent" | "simulated" | "failed"; detail?: string };

/** Send a WhatsApp message. Simulated (logged) when Twilio is not configured. */
export async function sendWhatsApp(phone: string, body: string): Promise<WhatsAppResult> {
  if (!client || !WHATSAPP_FROM) {
    console.log(`[SIM] WhatsApp -> ${phone}:\n${body}`);
    return { status: "simulated" };
  }
  try {
    const msg = await client.messages.create({
      from: WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
      body,
    });
    return { status: "sent", detail: msg.sid };
  } catch (e) {
    return { status: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Generate a 6-digit OTP, persist it with a 10-minute TTL, and deliver it
 * via WhatsApp. Bypasses Twilio Verify entirely so the sandbox number works.
 * In simulation mode (no Twilio credentials) the code is always 123456.
 */
export async function startVerification(phone: string): Promise<{ simulated: boolean }> {
  const OTP_TTL_MS = 10 * 60 * 1000;

  if (!twilioEnabled) {
    // Simulation: store a fixed code so checkVerification still hits the DB path.
    await prisma.otpCode.deleteMany({ where: { phone } });
    await prisma.otpCode.create({
      data: { phone, code: "123456", expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    console.log(`[SIM] OTP for ${phone} -> use code 123456`);
    return { simulated: true };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const result = await sendWhatsApp(
    phone,
    `Your FloodGuard verification code is: *${code}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
  );

  if (result.status === "failed") {
    throw new Error(result.detail ?? "Failed to send verification code via WhatsApp");
  }

  // Replace any previous code for this number.
  await prisma.otpCode.deleteMany({ where: { phone } });
  await prisma.otpCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  return { simulated: false };
}

/**
 * Verify an OTP. Deletes the code on success (single-use).
 * Returns false for wrong code, expired code, or unknown phone.
 */
export async function checkVerification(phone: string, code: string): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.code !== code.trim()) return false;

  // Single-use: delete on success.
  await prisma.otpCode.delete({ where: { id: record.id } });
  return true;
}
