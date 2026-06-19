import { PrismaClient, Subscriber, MessageThread } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ThreadMessage, appendMessages, createThread, closeThread } from './threadManager';
import { decrypt } from './cryptoUtil';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function getUserSubscribedLocations(phone: string): Promise<string[]> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { phone },
    include: { subscriptions: { include: { location: true } } },
  });

  if (!subscriber || subscriber.subscriptions.length === 0) {
    return [];
  }

  return subscriber.subscriptions.map((sub) => sub.location.name);
}

export async function evaluateThread(
  threadMessages: ThreadMessage[],
  latestUserMessage: string,
  subscribedLocations: string[]
): Promise<{
  isComplete: boolean;
  missingFields: string[];
  nextQuestion: string | null;
  extractedData: {
    location: string;
    predictedRisk: string;
    actualSituation: string;
    feedbackType: 'accurate' | 'inaccurate' | 'partial';
    comment?: string;
  } | null;
}> {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });

    const formattedMessages = threadMessages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    let locationSuggestions = '';
    if (subscribedLocations.length > 0) {
      locationSuggestions = `If location is missing, suggest these to the user in your next question: ${subscribedLocations.join(', ')}.`;
    }

    const prompt = `You are a feedback collector for a flood risk prediction system in Sri Lanka.
Collect structured feedback from users about flood risk predictions.
Required fields:
- location: which location the prediction or feedback was for
- predictedRisk: what risk level the system predicted percentage (high / medium / low)
- actualSituation: what actually happened (e.g. no flooding, minor flooding, severe flooding)
- feedbackType: "accurate" | "inaccurate" | "partial"
- comment: any extra comment (optional)

${locationSuggestions}

When generating the \`nextQuestion\`, subtly include details that have already been collected (such as the location or predicted risk, if known) so the user has context and knows what the chatbot is referring to.

Conversation so far:
${formattedMessages}
Latest user message: "${latestUserMessage}"

Return ONLY valid JSON — no markdown, no explanation:
{
  "isComplete": boolean,
  "missingFields": string[],
  "nextQuestion": string | null,
  "extractedData": {
    "location": string,
    "predictedRisk": string,
    "actualSituation": string,
    "feedbackType": "accurate" | "inaccurate" | "partial",
    "comment": string | null
  } | null
}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response?.text())?.trim() ?? '';
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (error) {
    console.error('Thread evaluation failed:', error);
    // Return a fallback so the conversation doesn't completely break
    return {
      isComplete: false,
      missingFields: [],
      nextQuestion: "Sorry, I am having trouble understanding. Could you please clarify your feedback regarding the location and actual situation?",
      extractedData: null
    };
  }
}

export async function handleFeedbackThread(
  subscriberPhone: string,
  incomingMessage: string,
  activeThread: MessageThread | null
): Promise<string> {
  const subscribedLocations = await getUserSubscribedLocations(subscriberPhone);

  const threadMessages = activeThread ? (activeThread.messages as any as ThreadMessage[]).map(m => ({ role: m.role, content: decrypt(m.content), timestamp: m.timestamp })) : [];

  console.log("threadMessages: ", threadMessages);
  const result = await evaluateThread(
    threadMessages,
    incomingMessage,
    subscribedLocations
  );

  if (result.isComplete === false) {
    const botReply = result.nextQuestion || "Could you provide more details?";
    if (activeThread) {
      await appendMessages(activeThread.id, incomingMessage, botReply);
    } else {
      await createThread(subscriberPhone, 'REPORT_FEEDBACK', incomingMessage, botReply);
    }
    return botReply;
  }

  // isComplete === true
  let threadId = activeThread?.id;

  if (!activeThread) {
    const newThread = await createThread(
      subscriberPhone,
      'REPORT_FEEDBACK',
      incomingMessage,
      "✅ Thank you for your feedback! It has been recorded and will help improve our predictions.\n\n"
    );
    threadId = newThread.id;
  } else {
    // Append the last successful user message and bot reply so the snapshot is complete
    await appendMessages(
      threadId!,
      incomingMessage,
      "✅ Thank you for your feedback! It has been recorded and will help improve our predictions.\n\n"
    );
  }

  // Reload the thread to get the full snapshot for saving
  const finalizedThread = await prisma.messageThread.findUnique({ where: { id: threadId! } });

  if (result.extractedData) {
    await prisma.userFeedback.create({
      data: {
        subscriberPhone: subscriberPhone,
        location: result.extractedData.location,
        predictedRisk: result.extractedData.predictedRisk || null,
        actualSituation: result.extractedData.actualSituation || null,
        feedbackType: result.extractedData.feedbackType || null,
        comment: result.extractedData.comment || null,
        threadSnapshot: finalizedThread?.messages ?? [],
        threadId: threadId!
      }
    });
  }

  await closeThread(threadId!);

  return "✅ Thank you for your feedback! It has been recorded and will help improve our predictions.\n\n";
}
