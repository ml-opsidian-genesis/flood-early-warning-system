import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
export const COMMON_BASE_RULES = `Provide concise advice (max 120 words). Do NOT give health‑related instructions, medical advice, or evacuation plans. Include a suggestion to contact emergency services at 119, Disaster Management Centre: 011-2136222 and provide other official contact info at the end of the response. Always try to refactor and keep instructions pointwise and concise to support Whatsapp messages. Use single "*" to bold text, and never use "**". For pointwise sentences, use "- sentence" (equivalent to bulletpoint sentences, dont use "•" symbol) before everyline to render them as points in whatsapp.`;
export const GENERAL_SYSTEM_RELATED_INFO = "We are a research based flood early warning system developed by UCSC undegrads and the system adheres with GDPR and PDPA privacy and ethics guidelines. Messages may storeed encrypted for context retaininig purposes, but not be stored for processing or commercial use, or sold to third parties. We strip personally identifiable data from messages while we encourage to not share them, and any data stored, will only be used to track the conversation context for better User Experience.";

// Shared fallback message for unexpected Gemini errors
export const DEFAULT_ERROR_MESSAGE = 'Sorry, we are experiencing technical difficulties. Please try again later.\n\n- You can reach emergency services at 119\n- Disaster Management Centre at 011-2136222';

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
  | 'MAIN_MENU'
  | 'UNKNOWN'
  | 'REPORT_FEEDBACK'
  | 'CANNOT_REACH_SERVICES';

export interface ClassifiedMessage {
  intent: Intent;
  severity?: string;
  location?: string;
  report_type?: string;
}

export async function classifyMessage(message: string, historyContext?: string): Promise<ClassifiedMessage> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    let prompt = `You are an emergency message classifier for a flood alert system in Sri Lanka.
Analyze the user message and return ONLY a JSON object with no markdown, no explanation.

Possible intents:
- REPORT_FLOOD: User is reporting flooding
- REPORT_DAMAGE: User is reporting property/road damage
- SHELTER_LOOKUP: User is looking for evacuation shelters
- ALERT_INFO: User wants current flood alert information
- PREPAREDNESS_HELP: User wants flood preparedness advice
- EMERGENCY_CONTACT: User wants emergency contact numbers
- GENERAL_QUESTION: General flood-related questions and service and data related (operational and model related) questions (like where is the data collected from, how do you predict, do you store my data, etc.) 
- MAIN_MENU: User wants to see the main menu options
- UNKNOWN: Cannot determine intent
- REPORT_FEEDBACK: User is providing feedback on a flood risk prediction

Return format:
{"intent": "INTENT_HERE", "severity": "low|medium|high|unknown", "location": "extracted location or null", "report_type": "flood|damage|null"}
`;

    if (historyContext) {
      prompt += `\nRecent conversation history for context:\n${historyContext}\n`;
    }
    prompt += `\nUser message: "${message}"`;
    const result = await model.generateContent(prompt);
    const text = (await result.response?.text())?.trim() ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as ClassifiedMessage;
    // If the model fails to classify, default to MAIN_MENU
    // return { intent: 'MAIN_MENU' };

  } catch (error) {
    console.error('Message classification failed:', error);
    // If the model fails to classify, default to MAIN_MENU
    return { intent: 'CANNOT_REACH_SERVICES' };
  }
}


export async function getPreparednessHelp(userMessage: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `You are a flood preparedness assistant for Sri Lanka in the ${process.env.SYSTEM_NAME} - flood risk early warning system. Using official guidance from the Department of Meteorology (https://www.dmc.gov.lk/index.php?lang=en) and other national emergency systems, provide concise, general preparedness advice in response to the user's request. ${COMMON_BASE_RULES}\\nUser request: \"${userMessage}\"`;
    const result = await model.generateContent(prompt);
    const raw = (await result.response?.text())?.trim() ?? '';
    // Limit to max 120 words
    const limited = raw.split(/\\s+/).slice(0, 120).join(' ');
    // Convert to point‑wise list for WhatsApp readability
    const formatted = formatPointwise(limited);
    return formatted;
  } catch (e) {
    console.error('Preparedness help generation failed:', e);
    return DEFAULT_ERROR_MESSAGE;
  }

}



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
        lines.push(`• ${loc.name} (${loc.district}): Risk of flooding is ${(latestScore.score * 100).toFixed(1)}% (${latestScore.riskLevel})`);
      }
    }
    if (forecastDate) {
      lines.unshift(`Forecast for ${forecastDate}:\n`);
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
// Returns a simple text menu for WhatsApp interactions
export function getMainMenu(): string {
  return `Here are the things you can do with the Flood Early Warning System assistant:

• View Flood Risk – get the latest forecast for your subscribed locations
• Emergency Contacts – quick numbers for disaster assistance
• Rescue shelters – find nearby rescue shelters
• Safety Tips – general flood‑safety guidance
• General Question – ask any flood‑related query
• Submit Feedback – share your thoughts on the risk scores

Just tell me, and I will do my best to provide you with the information you need.`;
}


/**
 * Handle a generic flood‑related question.
 * Returns a concise, point‑wise answer that references official resources and emergency contacts.
 * No health or evacuation advice is provided.
 */
export async function getGeneralQuestionResponse(userMessage: string): Promise<string> {
  try {
    const prompt = `You are a flood early‑warning assistant for Sri Lanka called ${process.env.SYSTEM_NAME}. Answer the user's flood‑related question in a concise, surface‑level manner. Do NOT give health advice, medical instructions, or evacuation plans. Include the official website and refer to https://flood-early-warning-system.vercel.app/ answer and emergency contacts: Disaster Management Centre 011-2136222, Police 119. ${COMMON_BASE_RULES}\nUser question: "${userMessage}"\n system related info : "${GENERAL_SYSTEM_RELATED_INFO}"`;
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const raw = (await result.response?.text())?.trim() ?? '';
    // Limit to 120 words as per COMMON_BASE_RULES
    const limited = raw.split(/\s+/).slice(0, 120).join(' ');
    return formatPointwise(limited);
  } catch (e) {
    console.error('General question handling failed:', e);
    return DEFAULT_ERROR_MESSAGE;
  }
}
