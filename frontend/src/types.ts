export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  extension?: string;
  modifiedAt: string;
  createdAt: string;
  isReadable: boolean;
  isWritable: boolean;
}

// --- WebSocket Commands (Client -> Server) ---

export type WebSocketCommand =
  | { type: 'file_watch_start'; payload: { projectId: string } }
  | { type: 'file_watch_stop'; payload: { projectId: string } }
  | { type: 'file_save_content'; payload: { filePath: string; content: string } }
  | { type: 'file_create'; payload: { filePath: string; content?: string } }
  | { type: 'file_delete'; payload: { filePath: string } }
  | { type: 'file_rename'; payload: { oldPath: string; newPath: string } }
  | { type: 'subscribe_terminal'; payload: { terminalId: string } }
  | { type: 'unsubscribe_terminal'; payload: { terminalId: string } }
  | { type: 'terminal_input'; payload: { terminalId: string; data: string } }
  | { type: 'terminal_resize'; payload: { terminalId: string; cols: number; rows: number } }
  | { type: 'subscribe_terminal_list'; payload: { projectId?: string } }
  | { type: 'unsubscribe_terminal_list'; payload: Record<string, never> };

// --- WebSocket Messages (Server -> Client) ---

export interface ConnectionEstablishedMessage {
  type: 'connection_established';
  timestamp: string;
  connectionId: string;
}

export interface FileWatchStartedMessage {
  type: 'file_watch_started';
  projectId: string;
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
  timestamp: string;
}

export interface FileEventMessage {
  type: 'file_event';
  eventType: 'file_created' | 'file_modified' | 'file_deleted' | 'directory_created' | 'directory_deleted' | 'watcher_ready' | 'file_error';
  projectId: string;
  filePath: string;
  timestamp: string;
  data: {
    projectId: string;
    fileInfo?: FileInfo;
    error?: string;
  };
}

export interface FileUpdatePayload {
  path: string;
  content: string;
  timestamp: number;
}

export interface TerminalOutputMessage {
  type: 'terminal_output';
  terminalId: string;
  data: string;
}

export interface TerminalHistoryMessage {
  type: 'terminal_history';
  sessionId: string;
  history: Array<{
    type: 'input' | 'output' | 'command' | 'exit';
    data: string;
    timestamp: string;
  }>;
}

export interface TerminalEventMessage {
  type: 'terminal_event';
  terminalId: string;
  event: string;
  data?: unknown;
}

export interface TerminalListUpdateMessage {
  type: 'terminal_list_update';
  terminals: Array<{
    id: string;
    command: string;
    projectId: string;
    cwd: string;
    startTime: string;
    lastActivity: string;
    isActive: boolean;
    pid: number;
  }>;
  timestamp: string;
}

export type WebSocketMessage =
  | ConnectionEstablishedMessage
  | FileWatchStartedMessage
  | ErrorMessage
  | FileEventMessage
  | TerminalOutputMessage
  | TerminalHistoryMessage
  | TerminalEventMessage
  | TerminalListUpdateMessage; 