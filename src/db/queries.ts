import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { conversations, messages, users } from "./schema";

export async function getOrCreateDemoUser() {
  const existing = await db.query.users.findFirst();
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ name: "Demo User" })
    .returning();
  return created;
}

export async function listConversations(userId: string) {
  return db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    orderBy: desc(conversations.updatedAt),
  });
}

export async function getConversation(id: string, userId: string) {
  return db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
  });
}

export async function getMessages(conversationId: string) {
  return db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: asc(messages.createdAt),
  });
}

export async function createConversation(
  userId: string,
  title = "New conversation",
) {
  const [created] = await db
    .insert(conversations)
    .values({ userId, title })
    .returning();
  return created;
}

export async function deleteConversation(id: string, userId: string) {
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function touchConversation(id: string) {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

export async function insertMessage(values: typeof messages.$inferInsert) {
  const [created] = await db.insert(messages).values(values).returning();
  return created;
}

export async function updateMessageContent(
  id: string,
  content: string,
  completed: boolean,
) {
  await db
    .update(messages)
    .set({ content, completedAt: completed ? new Date() : null })
    .where(eq(messages.id, id));
}
