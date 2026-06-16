import twilio from "twilio";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;
// OTP delivery channel: "sms" (default) or "whatsapp".
const VERIFY_CHANNEL = process.env.TWILIO_VERIFY_CHANNEL || "sms";

/** True when real Twilio credentials are configured. */
export const twilioEnabled = Boolean(SID && TOKEN);

const client = twilioEnabled ? twilio(SID, TOKEN) : null;

/** Basic E.164 check (e.g. +94771234567). */
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

/** Send an OTP via Twilio Verify (SMS or WhatsApp). Falls back to a fixed dev code. */
export async function startVerification(phone: string): Promise<{ simulated: boolean }> {
  if (!client || !VERIFY_SID) {
    console.log(`[SIM] OTP for ${phone} -> use code 123456`);
    return { simulated: true };
  }
  await client.verify.v2
    .services(VERIFY_SID)
    .verifications.create({ to: phone, channel: VERIFY_CHANNEL });
  return { simulated: false };
}

/** Check an OTP. In simulation mode the code 123456 is accepted. */
export async function checkVerification(phone: string, code: string): Promise<boolean> {
  if (!client || !VERIFY_SID) {
    return code === "123456";
  }
  try {
    const res = await client.verify.v2
      .services(VERIFY_SID)
      .verificationChecks.create({ to: phone, code });
    return res.status === "approved";
  } catch {
    return false;
  }
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
