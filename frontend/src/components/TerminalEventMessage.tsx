import React from "react";
import terminalStyles from "./TerminalWindow.module.css";

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  type?: string;
}

interface ToolEventParsed {
  tool?: string;
  type?: string;
  args?: {
    command?: string;
    description?: string;
    [key: string]: unknown;
  };
  result?: string;
  error?: string;
  [key: string]: unknown;
}

const safeString = (val: unknown) =>
  typeof val === "string" || typeof val === "number"
    ? val
    : JSON.stringify(val, null, 2);

const TerminalEventMessage: React.FC<{ message: ChatMessage }> = ({ message }) => {
  let parsed: ToolEventParsed | null = null;
  try {
    parsed = JSON.parse(message.content) as ToolEventParsed;
  } catch {
    parsed = null;
  }

  // If we have a command, render as CLI
  const command = parsed?.args && typeof parsed.args === 'object' && 'command' in parsed.args ? String(parsed.args.command) : undefined;
  const description = parsed?.args && typeof parsed.args === 'object' && 'description' in parsed.args ? String(parsed.args.description) : undefined;
  const result = parsed?.result !== undefined ? safeString(parsed.result) : undefined;
  const error = parsed?.error !== undefined ? safeString(parsed.error) : undefined;

  if (command) {
    return (
      <div className={terminalStyles.terminalWindow}>
        <div className={terminalStyles.terminalBody}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span className={terminalStyles.terminalPrompt}>$</span>
            <span className={terminalStyles.terminalCommand}>{command}</span>
          </div>
          {description && (
            <div style={{ color: '#38bdf8', fontSize: 14, marginBottom: 8 }}>{description}</div>
          )}
          {error ? (
            <div className={terminalStyles.terminalError}>{error}</div>
          ) : result ? (
            <div className={terminalStyles.terminalResult}>{result}</div>
          ) : null}
          <div className={terminalStyles.terminalTimestamp}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: old behavior (for legacy tool_event)
  const fallbackCommand = parsed?.tool ?? parsed?.type ?? "tool_event";
  const fallbackArgs = parsed?.args !== undefined ? safeString(parsed.args) : undefined;
  const fallbackResult = parsed?.result !== undefined ? safeString(parsed.result) : undefined;
  const fallbackError = parsed?.error !== undefined ? safeString(parsed.error) : undefined;
  return (
    <div className={terminalStyles.terminalWindow}>
      <div className={terminalStyles.terminalBody}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span className={terminalStyles.terminalPrompt}>$</span>
          <span className={terminalStyles.terminalCommand}>{safeString(fallbackCommand)}{fallbackArgs ? ` ${fallbackArgs}` : ""}</span>
        </div>
        {fallbackError ? (
          <div className={terminalStyles.terminalError}>{fallbackError}</div>
        ) : fallbackResult ? (
          <div className={terminalStyles.terminalResult}>{fallbackResult}</div>
        ) : null}
        <div className={terminalStyles.terminalTimestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

export default TerminalEventMessage; 