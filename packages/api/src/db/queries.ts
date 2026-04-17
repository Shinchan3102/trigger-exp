import { db, schema } from "./index.js";
import { eq, and, desc } from "drizzle-orm";
import type { UIMessage } from "ai";

type ChatMode = "agent";
type ChatStatus = "running" | "cancelled" | "completed";

export async function ensureChat({
  chatId,
  mode,
}: {
  chatId: string;
  mode?: ChatMode;
}) {
  let chatRecord = db
    .select()
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();

  if (!chatRecord) {
    db.insert(schema.chat)
      .values({
        id: chatId,
        mode: mode ?? "agent",
        status: "completed",
        metadata: {},
      })
      .run();

    chatRecord = db
      .select()
      .from(schema.chat)
      .where(eq(schema.chat.id, chatId))
      .get()!;
  }

  const messages = db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.chatId, chatId))
    .orderBy(schema.chatMessage.createdAt)
    .all();

  const uiMessages: UIMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: "",
    parts: (m.parts as any[]) ?? [],
    metadata: m.metadata as any,
    createdAt: new Date(m.createdAt),
  }));

  return { chat: chatRecord, messages: uiMessages };
}

export async function upsertMessage({
  chatId,
  message,
}: {
  chatId: string;
  message: UIMessage;
}) {
  const existing = db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.id, message.id))
    .get();

  if (existing) {
    db.update(schema.chatMessage)
      .set({
        parts: JSON.parse(JSON.stringify(message.parts)),
        metadata: message.metadata as any,
      })
      .where(eq(schema.chatMessage.id, message.id))
      .run();
  } else {
    db.insert(schema.chatMessage)
      .values({
        id: message.id,
        chatId,
        role: message.role as "user" | "assistant",
        parts: JSON.parse(JSON.stringify(message.parts)),
        metadata: message.metadata as any,
      })
      .run();
  }

  return db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.id, message.id))
    .get()!;
}

export async function updateChat({
  chatId,
  data,
}: {
  chatId: string;
  data: {
    status?: ChatStatus;
    streamId?: string | null;
    title?: string;
    metadata?: Record<string, unknown>;
    cancelledAt?: Date | null;
    updatedAt?: Date;
  };
}) {
  const updateData: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (data.status !== undefined) updateData.status = data.status;
  if (data.streamId !== undefined) updateData.streamId = data.streamId;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.metadata !== undefined)
    updateData.metadata = JSON.parse(JSON.stringify(data.metadata));

  db.update(schema.chat).set(updateData).where(eq(schema.chat.id, chatId)).run();
}

export async function listChats() {
  return db
    .select()
    .from(schema.chat)
    .orderBy(desc(schema.chat.updatedAt))
    .all();
}

export async function deleteChat(chatId: string) {
  db.delete(schema.chat).where(eq(schema.chat.id, chatId)).run();
}
