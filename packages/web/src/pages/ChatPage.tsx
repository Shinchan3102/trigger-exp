import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChatProvider } from "../components/ChatProvider";
import ChatView from "../components/ChatView";

const API_BASE = "/api/chat";

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

export default function ChatPage() {
  const { id: chatId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!chatId) return;

    fetch(`${API_BASE}/${chatId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.chat?.id) {
          setChatData(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [chatId]);

  if (!chatId) return null;
  if (!loaded) {
    return (
      <div className="app">
        <div className="header">
          <h1 onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
            trigger-exp
          </h1>
        </div>
        <div className="empty-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1 onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          trigger-exp
        </h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="new-chat-btn" onClick={() => navigate("/")}>
            All Chats
          </button>
          <button
            className="new-chat-btn"
            onClick={() => navigate(`/chat/${crypto.randomUUID()}`)}
          >
            + New Chat
          </button>
        </div>
      </div>

      <ChatProvider key={chatId} chatId={chatId} chatData={chatData}>
        <ChatView />
      </ChatProvider>

      <div className="status-bar">Chat: {chatId.slice(0, 8)}...</div>
    </div>
  );
}
