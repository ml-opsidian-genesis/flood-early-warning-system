import { NextRequest, NextResponse } from 'next/server';

/**
 * Twilio webhook for incoming WhatsApp messages.
 * Twilio sends a POST request with `application/x-www-form-urlencoded` data.
 * We parse the form data, log the inbound message, and respond with TwiML X`ML
 * so that Twilio knows the message was received.
 */

// export async function GET() {
//   console.log("GET HIT");
//   return Response.json({ ok: true });
// }

export async function POST(req: NextRequest) {
  console.log('Incoming request method:', req.method);
  // Twilio sends form‑encoded data, not JSON
  const formData = await req.formData();

  const from = formData.get('From') as string; // e.g. "whatsapp:+9477XXXXXXX"
  const body = formData.get('Body') as string; // e.g. "Water entering my house"

  console.log(`Message from ${from}: ${body}`);

  // TODO: Add your processing logic here (e.g., store in DB, trigger ML pipeline, etc.)

  // Twilio expects a TwiML XML response
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Message received! We are processing your request.</Message>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
