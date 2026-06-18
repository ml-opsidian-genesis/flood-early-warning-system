import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const COMMON_PREPAREDNESS_RULES = `Provide concise advice (max 120 words). Do NOT give health‑related instructions, medical advice, or evacuation plans. Include a suggestion to contact emergency services at 119, Disaster Management Centre: 011-2136222 and provide other official contact info at the end of the response. Always try to refactor and keep instructions pointwise and concise to support Whatsapp messages. Use single "*" to bold text, and never use "**".`;

// Shared fallback message for unexpected Gemini errors
export const DEFAULT_ERROR_MESSAGE = 'Sorry, we are experiencing technical difficulties. Please try again later.';

/**
 * Convert plain text into a bullet‑point list suitable for WhatsApp.
 * Splits on line breaks or periods, filters out empty fragments, and prefixes each with a bullet.
 */
export function formatPointwise(text: string): string {
  // Prefer explicit line breaks; if none, split on periods.
  const fragments = text.includes('\n')
    ? text.split('\n')
    : text.split(/(?<=\.)\s+/);
  const bullets = fragments
    .map(f => f.trim())
    .filter(f => f.length > 0)
    .map(f => `• ${f}`);
  return bullets.join('\n');
}


export type Intent =
  | 'REPORT_FLOOD'
  | 'REPORT_DAMAGE'
  | 'SHELTER_LOOKUP'
  | 'ALERT_INFO'
  | 'PREPAREDNESS_HELP'
  | 'EMERGENCY_CONTACT'
  | 'GENERAL_QUESTION'
  | 'UNKNOWN';

export interface ClassifiedMessage {
  intent: Intent;
  severity?: string;
  location?: string;
  report_type?: string;
}

export async function classifyMessage(message: string): Promise<ClassifiedMessage> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are an emergency message classifier for a flood alert system in Sri Lanka.
Analyze the user message and return ONLY a JSON object with no markdown, no explanation.

Possible intents:
- REPORT_FLOOD: User is reporting flooding
- REPORT_DAMAGE: User is reporting property/road damage
- SHELTER_LOOKUP: User is looking for evacuation shelters
- ALERT_INFO: User wants current flood alert information
- PREPAREDNESS_HELP: User wants flood preparedness advice
- EMERGENCY_CONTACT: User wants emergency contact numbers
- GENERAL_QUESTION: General flood-related question
- UNKNOWN: Cannot determine intent

Return format:
{"intent": "INTENT_HERE", "severity": "low|medium|high|unknown", "location": "extracted location or null", "report_type": "flood|damage|null"}
\nUser message: "${message}"`;
    const result = await model.generateContent(prompt);
    const text = (await result.response?.text())?.trim() ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as ClassifiedMessage;
  } catch (error) {
    return { intent: 'UNKNOWN' };
  }
}


export async function getPreparednessHelp(userMessage: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `You are a flood preparedness assistant for Sri Lanka. Using official guidance from the Department of Meteorology (https://www.dmc.gov.lk/index.php?lang=en) and other national emergency systems, provide concise, general preparedness advice in response to the user's request. ${COMMON_PREPAREDNESS_RULES}\\nUser request: \"${userMessage}\"`;
    const result = await model.generateContent(prompt);
    const raw = (await result.response?.text())?.trim() ?? '';
    // Limit to max 120 words
    const limited = raw.split(/\\s+/).slice(0, 120).join(' ');
    // Convert to point‑wise list for WhatsApp readability
    const formatted = formatPointwise(limited);
    return formatted;
  } catch (e) {
    console.error('Preparedness help generation failed:', e);
    return 'Stay safe, avoid flood‑affected areas, and follow official instructions. Call 119 for emergency assistance.';
  }

}



// Prisma client for database access
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Retrieve alert information for a subscriber based on their WhatsApp number.
 * Returns bullet‑point formatted alert details or a fallback URL.
 */
export async function getAlertInfo(whatsappNumber: string): Promise<string> {
  try {
    // Strip the "whatsapp:" prefix if present
    const phone = whatsappNumber.replace(/^whatsapp:/, "");
    const subscriber = await prisma.subscriber.findUnique({
      where: { phone },
      include: { subscriptions: { include: { location: true } } },
    });
    if (!subscriber || subscriber.subscriptions.length === 0) {
      return "You have no subscribed locations. Visit https://flood-early-warning-system.vercel.app/ to view the risk map and subscribe to receive flood risk alerts.";
    }
    const lines: string[] = [];
    let forecastDate: string | null = null;
    for (const sub of subscriber.subscriptions) {
      const loc = sub.location;
      const latestScore = await prisma.riskScore.findFirst({
        where: { locationId: loc.id },
        orderBy: { createdAt: "desc" },
      });
      if (latestScore) {
        if (!forecastDate) {
          forecastDate = latestScore.scoredFor.toISOString().split("T")[0];
        }
        lines.push(`• ${loc.name} (${loc.district}): Score ${latestScore.score.toFixed(2)} (${latestScore.riskLevel})`);
      }
    }
    if (forecastDate) {
      lines.unshift(`Forecast for ${forecastDate}:\n\n`);
    }
    if (lines.length === 0) {
      return "No recent risk scores available. Visit https://flood-early-warning-system.vercel.app/ for the latest map.";
    }
    lines.push("\nFull map: https://flood-early-warning-system.vercel.app/");
    return lines.join("\n");
  } catch (e) {
    console.error("Alert info retrieval failed:", e);
    return DEFAULT_ERROR_MESSAGE;
  }
}

