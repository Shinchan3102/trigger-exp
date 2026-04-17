import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { UIMessage } from "ai";
import type { Chat } from "./chat.react";
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat";

interface ChatMeta {
  chatId: string;
  isNewChat: boolean;
}

interface ChatContextValue {
  chat: Chat<UIMessage>;
  transport: TriggerChatTransport | null;
  meta: ChatMeta;
}

export const ChatCtx = createContext<ChatContextValue | null>(null);

function useChatCtx() {
  const ctx = useContext(ChatCtx);
  if (!ctx) throw new Error("Chat hooks must be used within ChatProvider");
  return ctx;
}

export function useChatMessages(): UIMessage[] {
  const { chat } = useChatCtx();
  const subscribe = useCallback(
    (cb: () => void) => chat["~registerMessagesCallback"](cb, 100),
    [chat],
  );
  return useSyncExternalStore(
    subscribe,
    () => chat.messages,
    () => chat.messages,
  );
}

export function useChatStatus() {
  const { chat } = useChatCtx();
  return useSyncExternalStore(
    chat["~registerStatusCallback"],
    () => chat.status,
    () => chat.status,
  );
}

export function useChatError() {
  const { chat } = useChatCtx();
  return useSyncExternalStore(
    chat["~registerErrorCallback"],
    () => chat.error,
    () => chat.error,
  );
}

export function useChatActions() {
  const { chat, transport, meta } = useChatCtx();

  return useMemo(
    () => ({
      sendMessage: async (...args: Parameters<typeof chat.sendMessage>) => {
        const s = chat.status;
        if (s === "streaming" || s === "submitted") return;
        await chat.sendMessage(...args);
      },
      stop: async () => {
        chat.stop();
        await transport?.stopGeneration(meta.chatId);
      },
      setMessages: (
        messagesOrUpdater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[]),
      ) => {
        const resolved =
          typeof messagesOrUpdater === "function"
            ? messagesOrUpdater(chat.messages)
            : messagesOrUpdater;
        chat.messages = resolved;
      },
    }),
    [chat, transport, meta],
  );
}

export function useChatMeta() {
  const { meta } = useChatCtx();
  return useMemo(
    () => ({
      id: meta.chatId,
      isNewChat: meta.isNewChat,
    }),
    [meta.chatId, meta.isNewChat],
  );
}
