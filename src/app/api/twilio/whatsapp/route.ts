import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

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

  // --------------------------------------------------------------
  // 1️⃣ Generate a smart reply using Gemini AI
  // --------------------------------------------------------------
  async function generateGeminiReply(message: string): Promise<string> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: `You are a helpful assistant for a flood‑early‑warning system. Reply briefly to the user message: "${message}"` }] }],
      });
      const response = await result.response?.text();
      return response?.trim() || "We have received your message, thanks!";
    } catch (e) {
      console.error('Gemini reply generation failed:', e);
      return "We have received your message, thanks!";
    }
  }

  const generatedReply = await generateGeminiReply(body);

  // ----- Send a reply message via Twilio REST API -----
  // Load credentials from environment variables (add them to .env)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

  let messageSent = false;
  if (accountSid && authToken && whatsappFrom) {
    const { twiml: MessagingResponse } = await import('twilio/lib/twiml/MessagingResponse');
    const client = require('twilio')(accountSid, authToken);
    try {
      await client.messages.create({
        from: whatsappFrom,
        to: from,
        // Use the Gemini‑generated reply instead of the static text
        body: generatedReply,
      });
      console.log('Reply sent via Twilio API');
      messageSent = true;
    } catch (err) {
      console.error('Failed to send reply via Twilio API', err);
    }
  } else {
    console.warn('Twilio credentials missing – cannot send reply via API');
  }

  // Twilio also expects a TwiML XML response (optional but good for immediate ack)
  // Even though we already replied via the REST API, we keep a minimal TwiML ack for Twilio.
  const twiml = !messageSent ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Message received! We are processing your request.</Message>
</Response>` : "";

  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
