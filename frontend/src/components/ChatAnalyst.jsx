import { useState, useRef, useEffect } from "react";
import * as api from "../api";
import { inputStyle, btnPrimary } from "../styles";

export default function ChatAnalyst({ org, lessons }) {
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendChat = async (text) => {
    if (!text.trim() || !org) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const data = await api.chatWithAnalyst(org.id, text, messages);
      setMessages([...newMessages, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Error connecting. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 400 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: "linear-gradient(135deg, #1e3a5f, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚡</div>
            <h3 style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#94a3b8", marginBottom: 8 }}>AI Lessons Analyst</h3>
            <p style={{ fontSize: 13, color: "#475569", maxWidth: 480, margin: "0 auto 24px" }}>
              {lessons.length > 0 ? `${lessons.length} lessons loaded. Ask about patterns, gaps, or draft new lessons.` : "Add lessons first."}
            </p>
            {lessons.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 520, margin: "0 auto" }}>
                {["What are the most common root causes?", "What gaps exist for Arctic work?", "Draft a lesson about preheat failures", "Which lessons apply to a new mainline spread?"]
                  .map((p, i) => <button key={i} onClick={() => sendChat(p)} style={{ padding: "12px 14px", borderRadius: 6, border: "1px solid #1e293b", background: "#111827", color: "#94a3b8", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>{p}</button>)}
              </div>
            )}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", padding: "0 4px" }}>
            <div style={{ maxWidth: "85%", padding: "12px 16px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.role === "user" ? "#1e3a5f" : "#111827", border: `1px solid ${msg.role === "user" ? "#2563eb" : "#1e293b"}`, color: msg.role === "user" ? "#bfdbfe" : "#cbd5e1", fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              {msg.role === "assistant" && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: "#3b82f6", marginBottom: 6 }}>AI ANALYST</div>}
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 4px" }}>
            <div style={{ padding: "14px 18px", borderRadius: "12px 12px 12px 2px", background: "#111827", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", gap: 6 }}>{[0, 1, 2].map(n => <div key={n} style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />)}</div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div style={{ borderTop: "1px solid #1e293b", padding: "14px 0 0", display: "flex", gap: 8 }}>
        <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
          placeholder="Ask about patterns, gaps, or draft new lessons..." rows={1} style={{ flex: 1, ...inputStyle, padding: "12px 14px" }} />
        <button onClick={() => sendChat(chatInput)} disabled={chatLoading || !chatInput.trim()} style={{ ...btnPrimary, opacity: chatLoading || !chatInput.trim() ? 0.4 : 1 }}>Send</button>
      </div>
    </div>
  );
}
