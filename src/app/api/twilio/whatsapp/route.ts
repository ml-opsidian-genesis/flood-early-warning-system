import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";
import { classifyMessage, getPreparednessHelp, formatPointwise, DEFAULT_ERROR_MESSAGE, ClassifiedMessage, getAlertInfo, getMainMenu } from "./classifier";

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

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  console.log('Incoming request method:', req.method);

  // Twilio credentials (needed early for error handling)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886"

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
      const text = (response?.trim()) ?? "We have received your message, thanks!";
      // Format pointwise for WhatsApp readability
      return formatPointwise(text);
    } catch (e) {
      console.error('Gemini reply generation failed:', e);
      return DEFAULT_ERROR_MESSAGE;
    }
  }

  // Classify the incoming message to determine intent
  let classification: ClassifiedMessage;
  try {
    classification = await classifyMessage(body);
  } catch (e) {
    console.error('Classification failed:', e);
    // Send generic error via Twilio and respond
    const replyMessage = DEFAULT_ERROR_MESSAGE;
    let messageSent = false;
    if (accountSid && authToken && whatsappFrom) {
      const client = require('twilio')(accountSid, authToken);
      try {
        await client.messages.create({ from: whatsappFrom, to: from, body: replyMessage });
        console.log('Fallback reply sent via Twilio API');
        messageSent = true;
      } catch (err) {
        console.error('Failed to send fallback reply via Twilio API', err);
      }
    }
    const twiml = !messageSent ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyMessage}</Message>
</Response>` : "";
    return new NextResponse(twiml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }
  let replyMessage: string;
  switch (classification.intent) {
    case 'REPORT_FLOOD':
      replyMessage = 'Thank you for reporting the flood. Our team will investigate the location.';
      break;
    case 'REPORT_FEEDBACK':
      replyMessage = 'We have received your damage report and will forward it to the authorities.';
      break;
    case 'SHELTER_LOOKUP':
      replyMessage = 'Sorry, no rescue shelters are added to the system yet.';
      break;
    case 'ALERT_INFO':
      replyMessage = await getAlertInfo(from);
      break;
    case 'PREPAREDNESS_HELP':
      replyMessage = await getPreparednessHelp(body);
      break;
    case 'MAIN_MENU':
      replyMessage = getMainMenu();
      break;
    case 'EMERGENCY_CONTACT':
      replyMessage = 'Emergency Contacts:\n • Disaster Management Centre: 011-2136222\n • Police Emergency Hotline: 119\n\n⚠️ Safety Tip: Keep your phone charged, store important documents in a waterproof bag, and move to higher ground immediately if flooding is reported in your area.';
      break;
    case 'GENERAL_QUESTION':
      replyMessage = 'You can ask flood‑related questions.\n• Official info: https://flood-early-warning-system.vercel.app/\n• Emergency contacts: Disaster Management Centre 011-2136222, Police 119.';
      break;
    default:
      // If intent is unknown or not matched, send interactive main menu
      replyMessage = getMainMenu();
      break;
  }

  // Fallback/default message if no intent matched or error occurred earlier
  if (!replyMessage) {
    replyMessage = DEFAULT_ERROR_MESSAGE;
  }

  // ----- Send a reply message via Twilio REST API -----
  // Load credentials from environment variables (add them to .env)


  let messageSent = false;
  if (accountSid && authToken && whatsappFrom) {
    // No need for MessagingResponse import; using raw XML response
    const client = require('twilio')(accountSid, authToken);
    try {
      await client.messages.create({
        from: whatsappFrom,
        to: from,
        body: replyMessage,
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
