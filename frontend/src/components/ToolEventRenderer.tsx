import React from "react";
import TerminalEventMessage from "./TerminalEventMessage";
import FileEventMessage from "./FileEventMessage";
import DirectoryEventMessage from "./DirectoryEventMessage";

interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  type?: string;
}

type Tool = {
  name: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
};

// Helper to detect tool type
function getToolType(toolName: string): 'terminal' | 'file' | 'directory' | 'other' {
  if (["run_shell_command", "run_terminal_cmd"].includes(toolName)) return 'terminal';
  if (["read_file", "replace", "write_file", "delete_file"].includes(toolName)) return 'file';
  if (["list_directory"].includes(toolName)) return 'directory';
  return 'other';
}

function isTool(obj: unknown): obj is Tool {
  return !!obj && typeof obj === 'object' && 'name' in obj && typeof (obj as { name: unknown }).name === 'string';
}

function getToolsArray(parsed: unknown): Tool[] | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const tools = (parsed as { tools?: unknown }).tools;
  if (Array.isArray(tools) && tools.every(isTool)) return tools as Tool[];
  return null;
}

function getSingleTool(parsed: unknown): Tool | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const tool = (parsed as { tool?: unknown }).tool;
  if (isTool(tool)) return tool;
  return null;
}

function getTypeString(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const type = (parsed as { type?: unknown }).type;
  if (typeof type === 'string') return type;
  return null;
}

// Detect "flat" terminal/file/directory events
function isFlatTerminal(obj: unknown): boolean {
  return !!obj && typeof obj === 'object' && 'command' in obj && typeof (obj as { command: unknown }).command === 'string';
}
function isFlatFile(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  // Heuristic: has file_path, old_string, new_string, or similar
  return (
    'file_path' in obj || 'absolute_path' in obj || 'old_string' in obj || 'new_string' in obj || 'write' in obj
  );
}
function isFlatDirectory(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return 'path' in obj && 'result' in obj && Array.isArray((obj as { result: unknown }).result);
}

const ToolEventRenderer: React.FC<{ message: ChatMessage }> = ({ message }) => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(message.content);
  } catch {
    console.log('[ToolEventRenderer] Failed to parse message.content:', message.content);
    return <div style={{ color: '#f87171', background: '#18181b', borderRadius: 10, padding: 16, fontFamily: 'Fira Mono, monospace', margin: '18px 0' }}>Ошибка парсинга tool_event</div>;
  }
  console.log('[ToolEventRenderer] Parsed:', parsed);

  // Batch tools (tools: [])
  const toolsArr = getToolsArray(parsed);
  if (toolsArr) {
    console.log('[ToolEventRenderer] Detected tools array:', toolsArr);
    return <>
      {toolsArr.map((tool, i) => {
        const type = getToolType(tool.name);
        console.log(`[ToolEventRenderer] Rendering tool[${i}] type:`, type, tool);
        if (type === 'terminal') return <TerminalEventMessage key={i} message={{...message, content: JSON.stringify(tool)}} />;
        if (type === 'file') return <FileEventMessage key={i} tool={tool} timestamp={message.timestamp} />;
        if (type === 'directory') return <DirectoryEventMessage key={i} tool={tool} timestamp={message.timestamp} />;
        // Fallback for unknown tool
        return <div key={i} style={{ background: '#23272e', color: '#fff', borderRadius: 10, padding: 14, margin: '12px 0', fontFamily: 'Fira Mono, monospace' }}>
          <b>{tool.name}</b>
          <pre style={{ margin: 0, fontSize: 13 }}>{tool.result ? String(tool.result) : tool.error ? String(tool.error) : 'Выполнено.'}</pre>
        </div>;
      })}
    </>;
  }

  // Single tool (tool: {...})
  const singleTool = getSingleTool(parsed);
  if (singleTool) {
    const type = getToolType(singleTool.name);
    console.log('[ToolEventRenderer] Rendering single tool type:', type, singleTool);
    if (type === 'terminal') return <TerminalEventMessage message={{...message, content: JSON.stringify(singleTool)}} />;
    if (type === 'file') return <FileEventMessage tool={singleTool} timestamp={message.timestamp} />;
    if (type === 'directory') return <DirectoryEventMessage tool={singleTool} timestamp={message.timestamp} />;
    return <div style={{ background: '#23272e', color: '#fff', borderRadius: 10, padding: 14, margin: '12px 0', fontFamily: 'Fira Mono, monospace' }}>
      <b>{singleTool.name}</b>
      <pre style={{ margin: 0, fontSize: 13 }}>{singleTool.result ? String(singleTool.result) : singleTool.error ? String(singleTool.error) : 'Выполнено.'}</pre>
    </div>;
  }

  // Flat terminal event
  if (isFlatTerminal(parsed)) {
    console.log('[ToolEventRenderer] Detected flat terminal event:', parsed);
    const obj = parsed as { command: string; description?: string; result?: string; error?: string };
    const tool = {
      tool: 'run_shell_command',
      args: { command: obj.command, description: obj.description },
      result: obj.result,
      error: obj.error,
    };
    return <TerminalEventMessage message={{...message, content: JSON.stringify(tool)}} />;
  }
  // Flat file event
  if (isFlatFile(parsed)) {
    console.log('[ToolEventRenderer] Detected flat file event:', parsed);
    return <FileEventMessage tool={parsed as Tool} timestamp={message.timestamp} />;
  }
  // Flat directory event
  if (isFlatDirectory(parsed)) {
    console.log('[ToolEventRenderer] Detected flat directory event:', parsed);
    return <DirectoryEventMessage tool={parsed as Tool} timestamp={message.timestamp} />;
  }

  // tools_start/tools_complete/tool_start/tool_complete events with type only
  const typeStr = getTypeString(parsed);
  if (typeStr) {
    console.log('[ToolEventRenderer] Detected type-only event:', typeStr);
    // Show as info block
    return <div style={{ background: '#23272e', color: '#38bdf8', borderRadius: 10, padding: 12, margin: '12px 0', fontFamily: 'Fira Mono, monospace', fontWeight: 600 }}>
      {typeStr.replace(/_/g, ' ')}
    </div>;
  }

  console.log('[ToolEventRenderer] Fallback rendering for:', parsed);
  // Fallback
  return <div style={{ background: '#23272e', color: '#fff', borderRadius: 10, padding: 14, margin: '12px 0', fontFamily: 'Fira Mono, monospace' }}>
    Tool event
  </div>;
};

export default ToolEventRenderer; 