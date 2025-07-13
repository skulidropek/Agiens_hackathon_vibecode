import React from "react";

interface FileTool {
  name: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
}

function getStringField(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
  }
  return undefined;
}

const FileEventMessage: React.FC<{ tool: FileTool; timestamp: string }> = ({ tool, timestamp }) => {
  const { name, args, result, error } = tool;
  const filePath = getStringField(args, 'file_path') || getStringField(args, 'absolute_path') || getStringField(args, 'path') || "";
  const oldString = getStringField(args, 'old_string');
  const newString = getStringField(args, 'new_string');

  // Simple diff: highlight removed (red) and added (green) lines
  let diffBlock = null;
  if (oldString !== undefined && newString !== undefined) {
    const oldLines = String(oldString).split("\n");
    const newLines = String(newString).split("\n");
    diffBlock = (
      <pre style={{ background: "#111", color: "#fff", borderRadius: 10, padding: 12, marginTop: 8, fontFamily: 'Fira Mono, monospace', fontSize: 14, overflowX: 'auto' }}>
        {oldLines.map((line, i) =>
          !newLines.includes(line) ? (
            <div key={"old-"+i} style={{ color: "#f87171" }}>- {line}</div>
          ) : null
        )}
        {newLines.map((line, i) =>
          !oldLines.includes(line) ? (
            <div key={"new-"+i} style={{ color: "#22c55e" }}>+ {line}</div>
          ) : null
        )}
      </pre>
    );
  }

  const renderValue = (val: unknown) => {
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (val !== undefined) return JSON.stringify(val, null, 2);
    return null;
  };

  return (
    <div style={{ background: "#18181b", color: "#fff", borderRadius: 14, padding: 18, margin: "18px 0", fontFamily: 'Fira Mono, monospace', boxShadow: "0 2px 12px 0 #0006" }}>
      <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>
        {name.replace(/_/g, ' ')} {filePath && <span style={{ color: "#fff", fontWeight: 400 }}>/ {filePath}</span>}
      </div>
      {diffBlock}
      {result !== undefined && <pre style={{ background: "#23272e", color: "#fff", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{renderValue(result)}</pre>}
      {error !== undefined && <pre style={{ background: "#3b1d1d", color: "#f87171", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{renderValue(error)}</pre>}
      <div style={{ color: "#6b7280", fontSize: 12, textAlign: "right", marginTop: 12, letterSpacing: ".08em" }}>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
};

export default FileEventMessage; 