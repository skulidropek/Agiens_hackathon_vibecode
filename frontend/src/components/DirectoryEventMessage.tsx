import React from "react";

interface DirectoryTool {
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

const DirectoryEventMessage: React.FC<{ tool: DirectoryTool; timestamp: string }> = ({ tool, timestamp }) => {
  const { args, result, error } = tool;
  const path = getStringField(args, 'path') || "";
  // Try to parse result as a list if possible
  let items: string[] = [];
  if (typeof result === "string") {
    items = result.split(/\n|,|;/).map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(result)) {
    items = result;
  }
  const renderValue = (val: unknown) => {
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    if (val !== undefined) return JSON.stringify(val, null, 2);
    return null;
  };
  return (
    <div style={{ background: "#18181b", color: "#fff", borderRadius: 14, padding: 18, margin: "18px 0", fontFamily: 'Fira Mono, monospace', boxShadow: "0 2px 12px 0 #0006" }}>
      <div style={{ fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>
        Directory listing <span style={{ color: "#fff", fontWeight: 400 }}>/ {path}</span>
      </div>
      {error !== undefined && <pre style={{ background: "#3b1d1d", color: "#f87171", borderRadius: 8, padding: 10, marginTop: 8, fontSize: 14, overflowX: 'auto' }}>{renderValue(error)}</pre>}
      {items.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14 }}>
          {items.map((item, i) => (
            <li key={i} style={{ color: item.startsWith('.') ? '#888' : '#fff', padding: '2px 0' }}>{item}</li>
          ))}
        </ul>
      )}
      <div style={{ color: "#6b7280", fontSize: 12, textAlign: "right", marginTop: 12, letterSpacing: ".08em" }}>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
};

export default DirectoryEventMessage; 