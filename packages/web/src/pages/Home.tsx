import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ChatItem {
  id: string;
  title: string | null;
  status: string;
  mode: string;
  updatedAt: string;
  createdAt: string;
}

const API_BASE = "/api/chat";

export default function Home() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = async () => {
    try {
      const res = await fetch(`${API_BASE}/list`);
      const data = await res.json();
      setChats(data);
    } catch (e) {
      console.error("Failed to fetch chats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []);

  const handleNewChat = () => {
    const id = crypto.randomUUID();
    navigate(`/chat/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    await fetch(`${API_BASE}/${chatId}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  return (
    <div className="app">
      <div className="header">
        <h1>trigger-exp</h1>
        <button className="new-chat-btn" onClick={handleNewChat}>
          + New Chat
        </button>
      </div>

      <div className="chat-list">
        {loading && <div className="empty-state">Loading chats...</div>}
        {!loading && chats.length === 0 && (
          <div className="empty-state">No chats yet. Start a new one!</div>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            className="chat-list-item"
            onClick={() => navigate(`/chat/${chat.id}`)}
          >
            <div className="chat-list-info">
              <span className="chat-list-title">
                {chat.title || chat.id.slice(0, 8) + "..."}
              </span>
              <span className={`chat-list-status ${chat.status}`}>
                {chat.status}
              </span>
            </div>
            <div className="chat-list-meta">
              <span>{new Date(chat.updatedAt).toLocaleString()}</span>
              <button
                className="chat-list-delete"
                onClick={(e) => handleDelete(e, chat.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
