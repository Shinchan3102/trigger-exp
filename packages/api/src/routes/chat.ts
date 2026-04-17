import { Hono } from "hono";
import { chat } from "@trigger.dev/sdk/ai";
import { auth } from "@trigger.dev/sdk/v3";
import type { agentChat } from "../trigger/agent-chat.js";
import { listChats, deleteChat, ensureChat, updateChat } from "../db/queries.js";

const CHAT_EXAMPLE_PAT_TTL = "15m";

const app = new Hono();

// Get access token for agent chat
app.get("/agent/token", async (c) => {
  console.log("[route] GET /agent/token");
  try {
    const token = await chat.createAccessToken<typeof agentChat>("agent-chat");
    console.log("[route] Token created successfully");
    return c.json({ publicAccessToken: token });
  } catch (e) {
    console.error("[route] Failed to create agent token:", e);
    return c.json({ error: "Failed to create token" }, 500);
  }
});

// Renew access token for an existing run
app.post("/agent/renew-token", async (c) => {
  console.log("[route] POST /agent/renew-token");
  try {
    const { runId } = await c.req.json<{ runId: string }>();
    console.log(`[route] Renewing token for runId=${runId}`);
    const token = await auth.createPublicToken({
      scopes: {
        read: { runs: runId },
        write: { inputStreams: runId },
      },
      expirationTime: CHAT_EXAMPLE_PAT_TTL,
    });
    console.log("[route] Token renewed successfully");
    return c.json({ publicAccessToken: token });
  } catch (e) {
    console.error("[route] Failed to renew token:", e);
    return c.json({ error: "Failed to renew token" }, 500);
  }
});

// List all chats
app.get("/list", async (c) => {
  console.log("[route] GET /list");
  const chats = await listChats();
  console.log(`[route] Found ${chats.length} chats`);
  return c.json(chats);
});

// Get a single chat with messages
app.get("/:chatId", async (c) => {
  const { chatId } = c.req.param();
  console.log(`[route] GET /${chatId}`);
  const { chat: chatRecord, messages } = await ensureChat({ chatId });
  console.log(`[route] Chat ${chatId}: status=${chatRecord.status} messages=${messages.length}`);
  return c.json({ chat: chatRecord, messages });
});

// Delete a chat
app.delete("/:chatId", async (c) => {
  const { chatId } = c.req.param();
  console.log(`[route] DELETE /${chatId}`);
  await deleteChat(chatId);
  return c.json({ ok: true });
});

export const chatRoutes = app;
