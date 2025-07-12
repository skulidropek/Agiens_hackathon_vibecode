import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { Api } from "../api/Api";
import type { RequestParams } from "../api/http-client";

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

// Типизация для tool_event
interface ToolEventParsed {
  type?: string;
  tool?: string;
  tools?: Array<{
    tool: string;
    args?: unknown;
    result?: unknown;
    error?: unknown;
  }>;
  args?: unknown;
  result?: unknown;
  error?: unknown;
}

// Универсальная функция для безопасного вывода значений в JSX
const safeString = (val: unknown) =>
  typeof val === "string" || typeof val === "number"
    ? val
    : JSON.stringify(val, null, 2);

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

  // Новый компонент для терминального вывода tool_event
  const TerminalEventMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
    let parsed: ToolEventParsed | null = null;
    try {
      parsed = JSON.parse(message.content) as ToolEventParsed;
    } catch {
      parsed = null;
    }
    // Определяем команду и результат
    const command = parsed?.tool ?? parsed?.type ?? "tool_event";
    const args = parsed?.args !== undefined ? safeString(parsed.args) : undefined;
    const result = parsed?.result !== undefined ? safeString(parsed.result) : undefined;
    const error = parsed?.error !== undefined ? safeString(parsed.error) : undefined;
    return (
      <div className="flex justify-center w-full">
        <div className="relative w-full max-w-2xl mb-8">
          {/* Glassmorphism background */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-800 to-gray-900 backdrop-blur-md border border-green-400/40 shadow-2xl shadow-green-900/30" style={{ zIndex: 0 }} />
          <div className="relative z-10 p-8 rounded-3xl overflow-hidden">
            {/* Prompt and command */}
            <div className="flex items-center mb-4">
              <span className="text-green-400 font-extrabold text-xl select-none drop-shadow-glow animate-pulse">$</span>
              <span className="ml-4 text-gray-100 break-all text-lg font-semibold tracking-wide drop-shadow">{safeString(command)}{args ? ` ${args}` : ""}</span>
            </div>
            {/* Result or error */}
            {error ? (
              <div className="mt-2 text-red-400 font-semibold text-base bg-red-900/20 rounded-xl px-4 py-2 shadow-inner border border-red-500/30 animate-fade-in">
                {error}
              </div>
            ) : result ? (
              <div className="mt-2 text-gray-200 text-base whitespace-pre-wrap leading-relaxed bg-gray-900/70 rounded-xl px-4 py-2 shadow-inner border border-gray-700/30 animate-fade-in">
                {result}
              </div>
            ) : null}
            {/* Batch tools */}
            {parsed?.tools && Array.isArray(parsed.tools) && (
              <div className="mt-6 space-y-4">
                {parsed.tools.map((t, i) => {
                  const tArgs = t.args !== undefined ? safeString(t.args) : undefined;
                  const tResult = t.result !== undefined ? safeString(t.result) : undefined;
                  const tError = t.error !== undefined ? safeString(t.error) : undefined;
                  return (
                    <div key={i} className="relative border-l-4 border-green-400 pl-6 py-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl shadow-lg group hover:scale-[1.01] transition-transform">
                      <div className="flex items-center mb-2">
                        <span className="text-green-400 font-extrabold text-lg select-none drop-shadow-glow">$</span>
                        <span className="ml-3 text-gray-100 break-all text-base font-semibold tracking-wide drop-shadow">{safeString(t.tool)}{tArgs ? ` ${tArgs}` : ""}</span>
                      </div>
                      {tError ? (
                        <div className="text-red-400 font-semibold text-sm bg-red-900/20 rounded-lg px-3 py-1 shadow-inner border border-red-500/20 animate-fade-in">
                          {tError}
                        </div>
                      ) : tResult ? (
                        <div className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed bg-gray-900/70 rounded-lg px-3 py-1 shadow-inner border border-gray-700/20 animate-fade-in">
                          {tResult}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Timestamp */}
            <div className="text-xs text-gray-500 text-right mt-6 tracking-widest select-none">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
    <div className="codex-main">
      <header className="codex-appbar">
        <div className="codex-logo" onClick={() => navigate("/")} style={{ cursor: 'pointer' }}>Codex</div>
        <nav className="codex-nav">
          <a href="#" className="codex-nav-link">Environments</a>
          <a href="#" className="codex-nav-link">Docs</a>
          <div className="codex-avatar">●</div>
        </nav>
      </header>
      <h1 className="codex-title">Session: {sessionId}</h1>
      <section className="codex-task-list-section w-full max-w-2xl mx-auto">
        <h2 className="codex-task-list-title text-xl font-semibold text-gray-700 mb-4">Messages</h2>
        <div className="codex-task-list flex flex-col gap-3 bg-gray-50 rounded-xl p-4 shadow-inner min-h-[300px] max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="codex-task-card text-gray-400">Загрузка...</div>
          ) : error ? (
            <div className="codex-task-card text-red-500">{error}</div>
          ) : messages.length === 0 && !streamingAI ? (
            <div className="codex-task-card text-gray-400">Нет сообщений</div>
          ) : (
            [...messages, ...(streamingAI ? [{ id: "streaming-ai", content: streamingAI, sender: "ai", timestamp: new Date().toISOString(), type: "chat_message" }] : [])]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              .map((m) => {
                if (m.type === "tool_event") {
                  return <TerminalEventMessage key={m.id} message={m} />;
                }
                return (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={
                        `max-w-[70%] px-5 py-3 rounded-2xl shadow-md mb-1 whitespace-pre-line break-words ` +
                        (m.sender === "user"
                          ? "bg-blue-600 text-white rounded-br-md"
                          : streamingAI && m.id === "streaming-ai"
                            ? "bg-gradient-to-r from-green-400/10 to-gray-100/10 text-green-700 border border-green-300 animate-pulse"
                            : "bg-white text-gray-900 border border-gray-200 rounded-bl-md")
                      }
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${m.sender === "user" ? "text-blue-200" : "text-blue-700"}`}>{m.sender === "user" ? "You" : "AI"}</span>
                        <span className="text-[10px] text-gray-400">{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {streamingAI && m.id === "streaming-ai" && <span className="ml-2 animate-pulse text-green-400">●</span>}
                      </div>
                      <div className="text-base leading-relaxed">{m.content}</div>
                    </div>
                  </div>
                );
              })
          )}
          <div ref={messagesEndRef} />
        </div>
      </section>
      <form className="codex-task-form w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 mt-8" onSubmit={handleSend}>
        <textarea
          className="codex-task-input w-full border border-gray-300 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
          placeholder="Type your message..."
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          disabled={sending || streaming}
        />
        <div className="codex-task-form-actions flex justify-end gap-2">
          <button type="submit" className="codex-btn codex-btn-primary bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-800 disabled:opacity-50" disabled={sending || streaming || !draft.trim()}>Send</button>
        </div>
      </form>
      <button className="codex-btn codex-btn-secondary mt-6 bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold hover:bg-gray-300" onClick={() => navigate("/")}>Back to sessions</button>
    </div>
  );
};

export default ChatPage; 