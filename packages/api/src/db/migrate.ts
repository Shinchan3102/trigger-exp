import Database from "better-sqlite3";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "../../data/chat.db");

mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables directly (no drizzle migration needed for simplicity)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS chat (
    id TEXT PRIMARY KEY,
    title TEXT,
    mode TEXT NOT NULL DEFAULT 'agent' CHECK(mode IN ('agent')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('running', 'cancelled', 'completed')),
    stream_id TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_message (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    parts TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id ON chat_message(chat_id);
  CREATE INDEX IF NOT EXISTS idx_chat_message_chat_id_created ON chat_message(chat_id, created_at);
`);

console.log("✓ Database migrated successfully at:", dbPath);
sqlite.close();
