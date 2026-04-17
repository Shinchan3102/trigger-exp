import React, { useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import { useChatMessages, useChatStatus, useChatActions } from "./ChatProvider";

function MessageParts({ message }: { message: UIMessage }) {
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "text" && part.text) {
          return <div key={i}>{part.text}</div>;
        }
        if (part.type === "tool-invocation") {
          const inv = part as any;
          return (
            <div key={i} className="tool-call">
              <div>
                <span className="tool-name">{inv.toolInvocation?.toolName ?? inv.toolName}</span>
                {" "}
                <span style={{ color: "#666" }}>
                  {inv.toolInvocation?.state ?? inv.state ?? "calling..."}
                </span>
              </div>
              {(inv.toolInvocation?.state === "result" || inv.state === "result") && (
                <div className="tool-result">
                  {JSON.stringify(inv.toolInvocation?.result ?? inv.result, null, 2)}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

export default function ChatView() {
  const messages = useChatMessages();
  const status = useChatStatus();
  const { sendMessage, stop } = useChatActions();

  const [input, setInput] = React.useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage({ parts: [{ type: "text", text: input }] });
    setInput("");
  };

  return (
    <>
      <div className="chat-container">
        {messages.length === 0 && (
          <div className="empty-state">
            Agent mode — tools: weather, deep research, calculator
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <MessageParts message={msg} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {isStreaming && (
        <div className="status-bar streaming">
          {status === "streaming" ? "Streaming response..." : "Processing..."}
          <button
            onClick={() => stop()}
            style={{
              marginLeft: 12,
              padding: "2px 10px",
              fontSize: 12,
              background: "#333",
              border: "1px solid #555",
              borderRadius: 4,
              color: "#ccc",
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        </div>
      )}

      <form className="input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything — I can research, calculate, check weather..."
          disabled={isStreaming}
        />
        <button type="submit" disabled={isStreaming || !input.trim()}>
          Send
        </button>
      </form>
    </>
  );
}
