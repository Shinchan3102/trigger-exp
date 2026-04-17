import { chat } from "@trigger.dev/sdk/ai";
import { z } from "zod";
import { streamText, smoothStream, stepCountIs } from "ai";
import type { UIMessage, ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { ensureChat, upsertMessage, updateChat } from "../db/queries.js";
import { get_weather, deep_research, calculate } from "../tools/mock-tools.js";

const MAX_PROMPT_LENGTH = 8000;

const SYSTEM_PROMPT = `You are a helpful AI agent. You have access to tools that let you:
- Get weather information for any city
- Perform deep research on any topic (this takes some time)
- Calculate mathematical expressions

Use these tools when the user's request would benefit from them. Be conversational and helpful.
When you use the deep_research tool, let the user know it may take a moment.`;

const clientDataSchema = z.object({
  userId: z.string().optional(),
});

type AgentLocals = {
  hasTitle: boolean;
  chatMetadata?: Record<string, unknown>;
};

const agentLocals = chat.local<AgentLocals>({
  id: "agentLocals",
});

export const agentChat = chat.withUIMessage<UIMessage>().agent({
  id: "agent-chat",
  clientDataSchema,
  maxDuration: 60 * 60 * 1000, // 1 hour

  onPreload: async ({ chatId, runId, chatAccessToken }) => {
    console.log(`[agent-chat] onPreload | chatId=${chatId} runId=${runId}`);
    const { chat: chatRecord } = await ensureChat({
      chatId,
      mode: "agent",
    });

    agentLocals.init({
      hasTitle: !!chatRecord.title,
      chatMetadata: (chatRecord.metadata as Record<string, unknown>) ?? {},
    });

    const triggerSession = { runId, publicAccessToken: chatAccessToken };
    await updateChat({
      chatId,
      data: {
        streamId: runId,
        metadata: { ...((chatRecord.metadata as any) ?? {}), triggerSession },
      },
    });
  },

  onValidateMessages: ({ messages }) => {
    console.log(`[agent-chat] onValidateMessages | count=${messages.length}`);
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "user") {
      const textLength =
        lastMessage.parts
          ?.filter((p) => p.type === "text")
          .reduce((len, p) => len + (p.type === "text" ? p.text.length : 0), 0) ?? 0;

      if (textLength > MAX_PROMPT_LENGTH) {
        throw new Error("PROMPT_LIMIT_EXCEEDED");
      }
    }
    return messages;
  },

  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    console.log(`[agent-chat] hydrateMessages | chatId=${chatId} trigger=${trigger} incoming=${incomingMessages.length}`);
    const { chat: chatRecord, messages: dbMessages } = await ensureChat({
      chatId,
      mode: "agent",
    });

    const chatMetadata = (chatRecord.metadata as Record<string, unknown>) ?? {};

    agentLocals.init({
      hasTitle: !!chatRecord.title,
      chatMetadata,
    });

    const ready = [...(dbMessages as UIMessage[])];

    const lastIncoming = incomingMessages.at(-1);
    if (trigger === "submit-message" && lastIncoming?.role === "user") {
      await upsertMessage({ chatId, message: lastIncoming });
      ready.push(lastIncoming);
    }

    return ready;
  },

  onTurnStart: async ({ chatId, runId, chatAccessToken }) => {
    console.log(`[agent-chat] onTurnStart | chatId=${chatId} runId=${runId}`);
    const chatMetadata = agentLocals.get().chatMetadata ?? {};
    const prevSession = (chatMetadata as any)?.triggerSession as
      | { lastEventId?: string }
      | undefined;
    const triggerSession = {
      runId,
      publicAccessToken: chatAccessToken,
      ...(prevSession?.lastEventId ? { lastEventId: prevSession.lastEventId } : {}),
    };

    await updateChat({
      chatId,
      data: {
        status: "running",
        streamId: runId,
        metadata: { ...chatMetadata, triggerSession },
      },
    });
  },

  onTurnComplete: async ({
    chatId,
    uiMessages,
    stopped,
    runId,
    chatAccessToken,
    lastEventId,
    totalUsage,
  }) => {
    const triggerSession = { runId, publicAccessToken: chatAccessToken, lastEventId };
    console.log(`[agent-chat] onTurnComplete | chatId=${chatId} stopped=${stopped} tokens=${totalUsage?.totalTokens ?? 0}`);

    // on update response comes as undefined so setting this from frontend using other stop endpoint by sending the streamed data there
    if (!stopped) {
      const lastAssistant = [...uiMessages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant) {
        await upsertMessage({ chatId, message: lastAssistant });
      }
    }

    await updateChat({
      chatId,
      data: {
        status: stopped ? "cancelled" : "completed",
        streamId: null,
        updatedAt: new Date(),
        metadata: {
          triggerSession,
          lastRunCompletedAt: new Date().toISOString(),
          lastRunTokens: totalUsage?.totalTokens ?? 0,
        },
      },
    });
  },

  prepareMessages: ({ messages }) => {
    console.log(`[agent-chat] prepareMessages | count=${messages.length}`);
    // Filter out empty text blocks that can cause model errors
    const cleaned = messages.map((m) => ({
      ...m,
      content: Array.isArray(m.content)
        ? m.content.filter((c: any) => c.type !== "text" || c.text?.length)
        : m.content,
    })) as ModelMessage[];
    return cleaned;
  },

  uiMessageStreamOptions: {
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("PROMPT_LIMIT_EXCEEDED")) return "Your message is too long. Please shorten it.";
      return "Something went wrong. Please try again.";
    },
  },

  run: async ({ messages, signal }) => {
    console.log(`[agent-chat] run | messages=${messages.length}`);
    return streamText({
      ...chat.toStreamTextOptions(),
      model: openai("gpt-4o"),
      system: SYSTEM_PROMPT,
      tools: { get_weather, deep_research, calculate },
      messages,
      abortSignal: signal,
      experimental_transform: smoothStream({ chunking: "line" }),
      stopWhen: [stepCountIs(10)],
    });
  },
});
