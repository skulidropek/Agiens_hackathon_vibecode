import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Api } from "../api/Api";
import type { RequestParams } from "../api/http-client";
import styles from "./ChatPage.module.css";
import ToolEventRenderer from "./ToolEventRenderer";

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  type?: string;
}
interface Session {
  id: string;
  projectId: string;
}

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [projectId, setProjectId] = useState<string | undefined>(
    (location.state as { projectId?: string })?.projectId || searchParams.get("projectId") || undefined
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [streamingAI, setStreamingAI] = useState<string>("");
  const [streaming, setStreaming] = useState<boolean>(false);

  useEffect(() => {
    if (!projectId && sessionId) {
      const fetchProjectId = async () => {
        try {
          const api = new Api();
          const projectsRes = await api.projectsList();
          const projects = (projectsRes.data?.projects || []) as { id: string }[];
          for (const p of projects) {
            const sessionsRes = await api.chatSessionsList({ query: { projectId: p.id } } as unknown as Parameters<typeof api.chatSessionsList>[0]);
            let sessions: Session[] | undefined = undefined;
            if (typeof sessionsRes.json === "function") {
              const parsed = await sessionsRes.json();
              sessions = parsed?.data;
            }
            if (Array.isArray(sessions) && sessions.find((s) => s.id === sessionId)) {
              setProjectId(p.id);
              return;
            }
          }
          setError("Не удалось определить projectId для этой сессии");
        } catch {
          setError("Ошибка поиска projectId по sessionId");
        }
      };
      fetchProjectId();
    }
  }, [projectId, sessionId]);

  useEffect(() => {
    if (!sessionId || !projectId) {
      setError("SessionId или projectId не передан");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const fetchHistory = async () => {
      try {
        const api = new Api();
        const res = await api.chatSessionsHistoryList(
          sessionId,
          undefined,
          { query: { projectId } } as unknown as Parameters<typeof api.chatSessionsHistoryList>[2]
        );
        let msgs: ChatMessage[] | undefined = undefined;
        if (typeof res.json === "function") {
          const parsed = await res.json();
          msgs = parsed?.data?.messages;
        }
        setMessages(Array.isArray(msgs) ? msgs : []);
      } catch {
        setError("Ошибка загрузки истории чата");
        setMessages([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [sessionId, projectId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // --- Новая функция отправки и стриминга ---
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft.trim()) return;
    if (!projectId || !sessionId) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        content: `Ошибка: projectId или sessionId не определены. projectId=${projectId}, sessionId=${sessionId}`,
        sender: "ai",
        timestamp: new Date().toISOString(),
        type: "chat_message",
      }]);
      return;
    }
    if (sending || streaming) return;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      content: draft,
      sender: "user",
      timestamp: new Date().toISOString(),
      type: "chat_message",
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);
    setStreamingAI("");
    setStreaming(true);
    try {
      const api = new Api();
      const payload = { message: draft, options: { sessionId } };
      console.log("[Chat] projectsChatStreamCreate", projectId, payload);
      // Важно: rawResponse: true чтобы получить Response и работать с потоком
      const resp = await api.projectsChatStreamCreate(projectId, payload, { rawResponse: true } as unknown as RequestParams & { rawResponse: boolean });
      console.log("[Chat] fetch status", resp.status);
      if (!resp.body) throw new Error("No stream");
      const reader = resp.body.getReader();
      let aiMsg = "";
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          chunk.split(/\n\n+/).forEach((eventStr) => {
            if (!eventStr.trim().startsWith("data:")) return;
            const dataStr = eventStr.replace(/^data:/, "").trim();
            if (!dataStr) return;
            try {
              const event = JSON.parse(dataStr);
              console.log("[Chat] SSE event", event);
              if (event.type === "content" && event.content) {
                aiMsg += event.content;
                setStreamingAI(aiMsg);
              }
              if (event.type === "tool_start" || event.type === "tools_start" || event.type === "tools_complete") {
                setMessages((prev) => [...prev, {
                  id: `tool-${Date.now()}-${Math.random()}`,
                  content: JSON.stringify(event),
                  sender: "ai",
                  timestamp: event.timestamp || new Date().toISOString(),
                  type: "tool_event",
                }]);
              }
              if (event.type === "complete") {
                setMessages((prev) => [...prev, {
                  id: `ai-${Date.now()}`,
                  content: event.final_response || aiMsg,
                  sender: "ai",
                  timestamp: event.timestamp || new Date().toISOString(),
                  type: "chat_message",
                }]);
                setStreamingAI("");
                setStreaming(false);
              }
              if (event.type === "error") {
                setMessages((prev) => [...prev, {
                  id: `err-${Date.now()}`,
                  content: event.error || "AI error",
                  sender: "ai",
                  timestamp: event.timestamp || new Date().toISOString(),
                  type: "chat_message",
                }]);
                setStreamingAI("");
                setStreaming(false);
              }
            } catch (err) {
              console.error("[Chat] SSE parse error", err, dataStr);
            }
          });
        }
      }
    } catch (err) {
      console.error("[Chat] fetch/send error", err);
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        content: `Ошибка отправки или получения ответа от AI: ${err instanceof Error ? err.message : String(err)}`,
        sender: "ai",
        timestamp: new Date().toISOString(),
        type: "chat_message",
      }]);
      setStreamingAI("");
      setStreaming(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.logo} onClick={() => navigate("/")}>Codex</div>
        <div className={styles.title}>Session: {sessionId}</div>
      </header>
      <section className={styles.messages}>
        {loading ? (
          <div className={`${styles.messageRow} ${styles.justifyStart}`}>
            <div className={`${styles.bubble} ${styles.aiBubble}`}>Загрузка...</div>
          </div>
        ) : error ? (
          <div className={`${styles.messageRow} ${styles.justifyStart}`}>
            <div className={`${styles.bubble} ${styles.aiBubble}`}>{error}</div>
          </div>
        ) : messages.length === 0 && !streamingAI ? (
          <div className={`${styles.messageRow} ${styles.justifyStart}`}>
            <div className={`${styles.bubble} ${styles.aiBubble}`}>Нет сообщений</div>
          </div>
        ) : (
          [...messages, ...(streamingAI ? [{ id: "streaming-ai", content: streamingAI, sender: "ai", timestamp: new Date().toISOString(), type: "chat_message" }] : [])]
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            .map((m) => {
              if (m.type === "tool_event") {
                return <ToolEventRenderer key={m.id} message={m} />;
              }
              return (
                <div
                  key={m.id}
                  className={`${styles.messageRow} ${m.sender === "user" ? styles.justifyEnd : styles.justifyStart}`}
                >
                  <div
                    className={
                      `${styles.bubble} ` +
                      (m.sender === "user"
                        ? styles.userBubble
                        : streamingAI && m.id === "streaming-ai"
                          ? styles.aiBubble // Optionally add a streaming style
                          : styles.aiBubble)
                    }
                  >
                    <div className={styles.meta}>
                      <span className={m.sender === "user" ? styles.userSender : styles.aiSender}>{m.sender === "user" ? "You" : "AI"}</span>
                      <span className={styles.time}>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {streamingAI && m.id === "streaming-ai" && <span style={{ marginLeft: 8, color: "#38bdf8", animation: "pulse 1.5s infinite" }}>●</span>}
                    </div>
                    <div>{m.content}</div>
                  </div>
                </div>
              );
            })
        )}
        <div ref={messagesEndRef} />
      </section>
      <form className={styles.inputBar} onSubmit={handleSend}>
        <textarea
          className={styles.textarea}
          placeholder="Type your message..."
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={sending || streaming}
        />
        <button type="submit" className={styles.sendBtn} disabled={sending || streaming || !draft.trim()}>Send</button>
      </form>
      <button className={styles.backBtn} onClick={() => navigate("/")}>Back to sessions</button>
    </div>
  );
};

export default ChatPage; 