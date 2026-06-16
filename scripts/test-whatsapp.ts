/**
 * Send a one-off test WhatsApp message to verify Twilio is wired correctly.
 *
 *   npm run whatsapp:test -- +9477XXXXXXX
 *
 * The number must have joined your Twilio WhatsApp sandbox first.
 */
const twilio = require("twilio");
import { readFileSync } from "node:fs";

// Minimal .env loader (this standalone script isn't run by Next).
function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {
    /* no .env — rely on shell env */
  }
}

async function main() {
  loadEnv();

  const to = process.argv[2];
  if (!to) {
    console.error("Usage: npm run whatsapp:test -- +9477XXXXXXX");
    process.exit(1);
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error(
      "Missing Twilio env vars. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env",
    );
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  try {
    const msg = await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${to}`,
      body: "✅ FloodGuard test alert — your Twilio WhatsApp integration works!",
    });
    console.log(`Sent. SID=${msg.sid} status=${msg.status}`);
  } catch (e: any) {
    console.error(`Failed: ${e?.message ?? e}`);
    if (e?.code) console.error(`Twilio error code: ${e.code} (see https://www.twilio.com/docs/api/errors/${e.code})`);
    process.exit(1);
  }
}

main();
