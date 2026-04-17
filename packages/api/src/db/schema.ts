import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const chat = sqliteTable("chat", {
  id: text("id").primaryKey(),
  title: text("title"),
  mode: text("mode", { enum: ["agent"] })
    .notNull()
    .default("agent"),
  status: text("status", { enum: ["running", "cancelled", "completed"] })
    .notNull()
    .default("completed"),
  streamId: text("stream_id"),
  metadata: text("metadata", { mode: "json" }).$type<{
    triggerSession?: {
      runId: string;
      publicAccessToken: string;
      lastEventId?: string;
    };
    lastRunTokens?: number;
    lastRunCompletedAt?: string;
  }>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const chatMessage = sqliteTable("chat_message", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  parts: text("parts", { mode: "json" }).$type<any[]>(),
  metadata: text("metadata", { mode: "json" }).$type<{
    modelId?: string;
  }>(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Chat = typeof chat.$inferSelect;
export type ChatMessage = typeof chatMessage.$inferSelect;
