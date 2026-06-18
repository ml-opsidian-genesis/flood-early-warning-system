import { PrismaClient, MessageThread } from '@prisma/client';

const prisma = new PrismaClient();

export interface ThreadMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export async function getLastThread(phoneNumber: string): Promise<MessageThread | null> {
  const thread = await prisma.messageThread.findFirst({
    where: { phoneNumber },
    orderBy: { createdAt: 'desc' },
  });

  if (thread && thread.tobeContinued) {
    return thread;
  }
  return null;
}

export async function createThread(
  phoneNumber: string,
  intent: string,
  firstUserMessage: string,
  firstBotMessage: string
): Promise<MessageThread> {
  const messages: ThreadMessage[] = [
    { role: 'user', content: firstUserMessage, timestamp: new Date().toISOString() },
    { role: 'bot', content: firstBotMessage, timestamp: new Date().toISOString() }
  ];

  return await prisma.messageThread.create({
    data: {
      phoneNumber,
      intent,
      messages: messages as any,
      tobeContinued: true
    }
  });
}

export async function appendMessages(
  threadId: string,
  userMessage: string,
  botMessage: string
): Promise<void> {
  const thread = await prisma.messageThread.findUnique({ where: { id: threadId } });
  if (!thread) return;

  const messages = (thread.messages as any as ThreadMessage[]) || [];
  messages.push({ role: 'user', content: userMessage, timestamp: new Date().toISOString() });
  messages.push({ role: 'bot', content: botMessage, timestamp: new Date().toISOString() });

  await prisma.messageThread.update({
    where: { id: threadId },
    data: { messages: messages as any }
  });
}

export async function closeThread(threadId: string): Promise<void> {
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { tobeContinued: false }
  });
}
