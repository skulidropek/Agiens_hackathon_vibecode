import React from "react";

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  type?: string;
}

const TerminalEventMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  console.log('[TerminalEventMessage] message:', message);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(message.content);
    if (parsed && typeof parsed === 'object' && parsed !== null && 'content' in parsed && typeof (parsed as { content: string }).content === 'string') {
      try {
        parsed = JSON.parse((parsed as { content: string }).content);
      } catch {
        // Ошибка парсинга внутреннего JSON
      }
    }
  } catch {
    // Ошибка парсинга внешнего JSON
  }

  // Универсальный рендер для tools (массив) или tool (один объект)
  const renderTerminal = (tool: Record<string, unknown>) => {
    if (!tool || typeof tool !== 'object') return null;
    const args = tool.args && typeof tool.args === 'object' && tool.args !== null ? tool.args as Record<string, unknown> : {};
    const command = 'command' in args && typeof args.command === 'string' ? args.command : undefined;
    const description = 'description' in args && typeof args.description === 'string' ? args.description : undefined;
    const result = 'result' in tool && typeof tool.result === 'string' ? tool.result as string : undefined;
    const error = 'error' in tool && typeof tool.error === 'string' ? tool.error as string : undefined;
    return (
      <>
        <div style={{background: 'purple', color: '#fff', padding: 4}}>TerminalEventMessage работает</div>
        <div style={{ background: "#18181b", color: "#fff", borderRadius: 14, padding: 18, margin: "18px 0", fontFamily: 'Fira Mono, monospace', boxShadow: "0 2px 12px 0 #0006" }}>
          <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>
            {command ? <><span style={{ color: '#6ee7b7', fontWeight: 'bold', fontSize: '1.15rem', marginRight: 12, userSelect: 'none' }}>$</span>{command}</> : 'Нет команды'}
          </div>
          {description && (
            <div style={{ color: '#38bdf8', fontSize: 14, marginBottom: 8 }}>{description}</div>
          )}
          {error !== undefined && <pre style={{ background: "#3b1d1d", color: "#f87171", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{error}</pre>}
          {result !== undefined && <pre style={{ background: "#23272e", color: "#fff", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{result}</pre>}
          {!command && <pre style={{ background: '#23272e', color: '#fff', borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{JSON.stringify(tool, null, 2)}</pre>}
          <div style={{ color: "#6b7280", fontSize: 12, textAlign: "right", marginTop: 12, letterSpacing: ".08em" }}>{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </>
    );
  };

  if (parsed && typeof parsed === 'object' && parsed !== null) {
    // tools (массив)
    if ('tools' in parsed && Array.isArray((parsed as { tools: Record<string, unknown>[] }).tools)) {
      const tools = (parsed as { tools: Record<string, unknown>[] }).tools;
      return <>{tools.map((tool) => renderTerminal(tool))}</>;
    }
    // tool (один объект)
    if ('tool' in parsed && typeof (parsed as { tool: Record<string, unknown> }).tool === 'object') {
      return renderTerminal((parsed as { tool: Record<string, unknown> }).tool);
    }
    // Если это сразу tool-объект
    if ('name' in parsed && 'args' in parsed) {
      return renderTerminal(parsed as Record<string, unknown>);
    }
  }

  // Fallback: показать JSON, если не удалось красиво
  return null;
};

export default TerminalEventMessage; 