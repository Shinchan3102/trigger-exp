import { useRef, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriggerChatTransport } from "@trigger.dev/sdk/chat";
import type { UIMessage } from "ai";
import { Chat } from "../lib/chat/chat.react";
import { ChatCtx } from "../lib/chat/chat-hooks";

export {
  useChatMessages,
  useChatStatus,
  useChatError,
  useChatActions,
  useChatMeta,
} from "../lib/chat/chat-hooks";

const API_BASE = "/api/chat";

interface TriggerSession {
  runId: string;
  publicAccessToken: string;
  lastEventId?: string;
}

interface ChatData {
  chat: {
    id: string;
    title: string | null;
    status: string;
    streamId: string | null;
    metadata: Record<string, unknown> | null;
  };
  messages: {
    id: string;
    role: string;
    parts: unknown[];
    metadata: unknown;
  }[];
}

export interface ChatProviderProps {
  children: ReactNode;
  chatId: string;
  chatData?: ChatData | null;
}

const getSessionFromChat = (chatData: ChatData | null | undefined): TriggerSession | null => {
  const session = (chatData?.chat?.metadata as Record<string, unknown>)?.triggerSession as
    | TriggerSession
    | undefined;
  if (!session?.runId || !session?.publicAccessToken) return null;
  return session;
};

async function fetchAccessToken() {
  const res = await fetch(`${API_BASE}/agent/token`);
  if (!res.ok) throw new Error(`Failed to fetch token: ${res.statusText}`);
  const data = await res.json();
  return data.publicAccessToken as string;
}

async function renewRunAccessToken(runId: string) {
  const res = await fetch(`${API_BASE}/agent/renew-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  return data.publicAccessToken as string;
}

function createTransport(chatId: string, session: TriggerSession | null) {
  return new TriggerChatTransport({
    task: "agent-chat",
    accessToken: fetchAccessToken,
    renewRunAccessToken: ({ runId }) => renewRunAccessToken(runId),
    clientData: { userId: "local-user" },
    sessions: session ? { [chatId]: session } : {},
    onSessionChange(changedChatId, newSession) {
      console.log(`[transport] session changed for ${changedChatId}:`, newSession ? "updated" : "cleared");
    },
  });
}

export function ChatProvider({ children, chatId, chatData }: ChatProviderProps) {
  const isNewChat = !chatData;

  const initialMessages = useMemo(
    () =>
      (chatData?.messages?.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: msg.parts as UIMessage["parts"],
        metadata: msg.metadata as UIMessage["metadata"],
      })) as UIMessage[]) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatData?.messages?.length],
  );

  const dbSession = getSessionFromChat(chatData);
  const chatRef = useRef<Chat<UIMessage> | null>(null);
  const transportRef = useRef<TriggerChatTransport | null>(null);

  if (!chatRef.current || chatRef.current.id !== chatId) {
    const transport = createTransport(chatId, dbSession);
    transportRef.current = transport;

    chatRef.current = new Chat<UIMessage>({
      id: chatId,
      messages: initialMessages,
      generateId: () => crypto.randomUUID(),
      transport,
      onFinish: ({ isAbort, isDisconnect, isError }) => {
        if (isDisconnect && !isAbort && !isError) {
          chatRef.current?.resumeStream();
        }
      },
      onError: (error) => {
        console.error("Chat error:", error.message);
      },
    });
  }

  const chatInstance = chatRef.current;

  const shouldResume = !!dbSession && chatData?.chat?.status === "running";
  const shouldPreload = !shouldResume && !!chatData?.chat?.id;

  useQuery({
    queryKey: ["chat-resume", chatId],
    queryFn: async () => {
      const s = chatInstance.status;
      if (s !== "streaming" && s !== "submitted") {
        await chatInstance.resumeStream();
      }
      return true;
    },
    enabled: shouldResume,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
    gcTime: 0,
  });

  useQuery({
    queryKey: ["chat-preload", chatId],
    queryFn: async () => {
      const s = chatInstance.status;
      if (s === "streaming" || s === "submitted") return true;
      await transportRef.current?.preload(chatId);
      return true;
    },
    enabled: shouldPreload,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
    gcTime: 0,
  });

  const ctx = useMemo(
    () => ({
      chat: chatInstance,
      transport: transportRef.current,
      meta: {
        chatId,
        isNewChat,
      },
    }),
    [chatId, isNewChat, chatInstance],
  );

  return <ChatCtx.Provider value={ctx}>{children}</ChatCtx.Provider>;
}
