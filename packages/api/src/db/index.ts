import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";

const dbPath = process.env.DB_PATH || resolve(process.cwd(), "data/chat.db");

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read/write
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
