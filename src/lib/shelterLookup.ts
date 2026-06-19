import { PrismaClient, MessageThread, Shelter } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ThreadMessage, appendMessages, createThread, closeThread } from './threadManager';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

/**
 * Convert a free-text location string into lat/lng coordinates using Nominatim.
 * Appends ", Sri Lanka" to bias results to the correct country.
 */
export async function geocodeLocation(
  locationText: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${locationText}, Sri Lanka`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'FloodAlertSystem/1.0' },
    });

    if (!response.ok) return null;

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    const result = results[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  } catch (error) {
    console.error('Geocoding failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

/**
 * Calculate the great-circle distance between two lat/lng points in kilometres.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ---------------------------------------------------------------------------
// Find nearby shelters
// ---------------------------------------------------------------------------

/**
 * Fetch all open shelters from the DB, filter to those within `maxDistanceKm`
 * of the user, sort by distance ascending, and return up to `limit` results.
 */
export async function findNearbyShelters(
  userLat: number,
  userLng: number,
  maxDistanceKm: number = 4,
  limit: number = 5
): Promise<Array<Shelter & { distanceKm: number }>> {
  // Fetch all open shelters. The total number of shelters is expected to be
  // small, so an in-memory Haversine filter is more than sufficient without
  // requiring a PostGIS extension or schema change.
  const shelters = await prisma.shelter.findMany({
    where: { status: 'open' },
  });

  const withDistance = shelters
    .map((shelter) => ({
      ...shelter,
      distanceKm: haversineDistanceKm(
        userLat,
        userLng,
        shelter.latitude,
        shelter.longitude
      ),
    }))
    .filter((s) => s.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return withDistance;
}

// ---------------------------------------------------------------------------
// Format shelter reply
// ---------------------------------------------------------------------------

/**
 * Format the WhatsApp reply for a shelter lookup result.
 */
export function formatShelterReply(
  locationText: string,
  shelters: Array<Shelter & { distanceKm: number }>
): string {
  if (shelters.length === 0) {
    return (
      `No open shelters found within 3km of ${locationText}.\n` +
      `Please contact DMC for assistance: 011-2136222\n` +
      `⚠️ If in immediate danger, call 119.`
    );
  }

  const shelterLines = shelters
    .map((s, idx) => {
      const lines: string[] = [
        `${idx + 1}. *${s.name}* (${s.distanceKm.toFixed(1)}km away)`,
        `📍 ${s.address}`,
      ];

      if (s.capacity !== null) {
        lines.push(`👥 Capacity: ${s.capacity} people`);
      }

      if (s.facilities && s.facilities.length > 0) {
        lines.push(`🛟 Facilities: ${s.facilities.join(', ')}`);
      }

      if (s.contactInfo) {
        lines.push(`📞 ${s.contactInfo}`);
      }

      if (s.description) {
        lines.push(s.description);
      }

      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  return (
    `🏥 *${shelters.length} shelter(s) found near ${locationText}:*\n\n` +
    shelterLines +
    `\n\n⚠️ If in immediate danger, call 119.`
  );
}

// ---------------------------------------------------------------------------
// Gemini-assisted thread evaluator
// ---------------------------------------------------------------------------

interface ShelterThreadEvaluation {
  isComplete: boolean;
  nextQuestion: string | null;
  extractedData: { locationText: string } | null;
}

/**
 * Use Gemini to determine whether enough information has been collected from
 * the conversation to perform a shelter lookup (i.e. a location name).
 */
async function evaluateShelterThread(
  threadMessages: ThreadMessage[],
  latestUserMessage: string
): Promise<ShelterThreadEvaluation> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    const formattedMessages = threadMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `You are a shelter-lookup assistant for a flood early-warning system in Sri Lanka called ${process.env.SYSTEM_NAME}.
Your goal is to collect the user's *current location* (city, town, or area name) so you can find nearby open rescue shelters.

Required field:
- locationText: the city, town, or area the user is currently in or near (e.g. "Colombo", "Moratuwa", "Gampaha")

Conversation so far:
${formattedMessages}
Latest user message: "${latestUserMessage}"

Rules:
- If the user has clearly provided a recognisable Sri Lankan place name, set isComplete = true and populate extractedData.
- If the location is vague or missing, set isComplete = false and set nextQuestion to a friendly, concise question asking for their current area. Include the system name for context.
- Keep nextQuestion under 40 words.
- Return ONLY valid JSON — no markdown, no explanation.

{
  "isComplete": boolean,
  "nextQuestion": string | null,
  "extractedData": { "locationText": string } | null
}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response?.text())?.trim() ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as ShelterThreadEvaluation;
  } catch (error) {
    console.error('Shelter thread evaluation failed:', error);
    return {
      isComplete: false,
      nextQuestion:
        'Which area or city are you currently in? (e.g. Colombo, Moratuwa, Gampaha)',
      extractedData: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Main handler — mirrors handleFeedbackThread
// ---------------------------------------------------------------------------

/**
 * Handle a SHELTER_LOOKUP message thread.
 * Collects the user's location over one or more turns, then returns a
 * formatted list of nearby open shelters (or a "none found" message).
 */
export async function handleShelterThread(
  phone: string,
  incomingMessage: string,
  activeThread: MessageThread | null
): Promise<string> {
  const threadMessages = activeThread
    ? (activeThread.messages as any as ThreadMessage[])
    : [];

  const evaluation = await evaluateShelterThread(
    threadMessages,
    incomingMessage
  );

  // --- Incomplete: still need more info from the user ---
  if (!evaluation.isComplete) {
    const botReply =
      evaluation.nextQuestion ||
      'Which area or city are you currently in? (e.g. Colombo, Moratuwa, Gampaha)';

    if (activeThread) {
      await appendMessages(activeThread.id, incomingMessage, botReply);
    } else {
      await createThread(phone, 'SHELTER_LOOKUP', incomingMessage, botReply);
    }

    return botReply;
  }

  // --- Complete: we have a location — geocode and search ---
  const locationText = evaluation.extractedData!.locationText;

  let replyMessage: string;

  try {
    const coords = await geocodeLocation(locationText);

    if (!coords) {
      replyMessage =
        `Sorry, I could not find coordinates for "${locationText}".\n` +
        `Please try a nearby well-known city or town name.\n\n` +
        `⚠️ If in immediate danger, call 119.\n` +
        `📞 DMC: 011-2136222`;
    } else {
      const nearbyShelters = await findNearbyShelters(
        coords.lat,
        coords.lng
      );
      replyMessage = formatShelterReply(locationText, nearbyShelters);
    }
  } catch (err) {
    console.error('Shelter lookup error:', err);
    replyMessage =
      'Sorry, I encountered an error looking up shelters. Please try again.\n\n' +
      '⚠️ If in immediate danger, call 119.\n' +
      '📞 DMC: 011-2136222';
  }

  // Persist the final exchange and close the thread
  if (activeThread) {
    await appendMessages(activeThread.id, incomingMessage, replyMessage);
    await closeThread(activeThread.id);
  } else {
    const newThread = await createThread(
      phone,
      'SHELTER_LOOKUP',
      incomingMessage,
      replyMessage
    );
    await closeThread(newThread.id);
  }

  return replyMessage;
}
