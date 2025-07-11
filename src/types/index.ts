// Базовые типы WebSocket сообщений
export interface BaseWebSocketMessage {
  type: string;
  timestamp?: string;
  id?: string;
}

// Типы сообщений для чата
export interface ChatMessage extends BaseWebSocketMessage {
  type: 'chat_message';
  content: string;
  sender: 'user' | 'ai';
  conversationId?: string;
  projectId?: string; // Добавляем привязку к проекту
}

export interface ChatResponse extends BaseWebSocketMessage {
  type: 'chat_response';
  content: string;
  sender: 'ai';
  conversationId?: string;
  projectId?: string; // Добавляем привязку к проекту
  streaming?: boolean;
}

export interface ChatError extends BaseWebSocketMessage {
  type: 'chat_error';
  error: string;
  code?: string;
  projectId?: string; // Добавляем привязку к проекту
}

// Типы сообщений для терминала
export interface TerminalOutput extends BaseWebSocketMessage {
  type: 'terminal_output';
  data: string;
  sessionId?: string;
}

export interface TerminalInput extends BaseWebSocketMessage {
  type: 'terminal_input';
  data: string;
  sessionId?: string;
}

export interface TerminalCommand extends BaseWebSocketMessage {
  type: 'terminal_command';
  command: string;
  sessionId?: string;
}

export interface TerminalStatus extends BaseWebSocketMessage {
  type: 'terminal_status';
  status: 'started' | 'stopped' | 'error';
  sessionId?: string;
  pid?: number;
}

// Типы для файлов
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

export interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  modifiedAt: string;
}

export interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'rename';
  path: string;
  newPath?: string;
  content?: string;
}

export interface FileChange extends BaseWebSocketMessage {
  type: 'file_change';
  operation: FileOperation;
  success: boolean;
  error?: string;
}

// Типы для AI интеграции
export interface AIContext {
  projectId?: string; // Добавляем ID активного проекта
  projectName?: string; // Добавляем имя проекта
  projectPath?: string; // Добавляем путь к проекту
  workspaceFiles: FileInfo[];
  currentDirectory: string;
  terminalHistory: string[];
  chatHistory: ChatMessage[];
}

export interface GeminiRequest {
  prompt: string;
  context?: AIContext;
  tools?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface GeminiResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

// Базовый интерфейс для WebSocket
export interface WebSocketLike {
  send: (data: string | Buffer) => void;
  close: (code?: number, reason?: string) => void;
  ping: (data?: Buffer) => void;
  terminate: () => void;
  readyState: number;
  OPEN: number;
  CLOSED: number;
  CONNECTING: number;
  CLOSING: number;
}

// Типы для WebSocket соединений
export interface WebSocketConnection {
  ws: WebSocketLike;
  id: string;
  type: 'chat' | 'terminal' | 'files';
  userId?: string;
  sessionId?: string;
  isAlive: boolean;
  lastPing: Date;
}

export type WebSocketEventType = 'open' | 'close' | 'error' | 'message' | 'ping' | 'pong';

export interface WebSocketEvent {
  type: WebSocketEventType;
  target: WebSocketLike;
  data?: string | Buffer;
  code?: number;
  reason?: string;
  error?: Error;
}

export type WebSocketEventListener = (event: WebSocketEvent) => void;

export interface WebSocketError {
  code: number;
  message: string;
  details?: WebSocketErrorDetails;
}

export interface WebSocketErrorDetails {
  connectionId?: string;
  sessionId?: string;
  eventType?: string;
  originalMessage?: string;
  timestamp?: string;
  retryCount?: number;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    protocol?: string;
  };
}

// Типы для сессий
export interface Session {
  id: string;
  userId?: string;
  conversationId: string;
  terminalSessionId?: string;
  projectId?: string; // Добавляем привязку к проекту
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Типы для API ответов
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetails;
  statusCode: number;
}

export interface ApiErrorDetails {
  field?: string;
  value?: string;
  constraint?: string;
  stack?: string;
  originalError?: {
    name: string;
    message: string;
    code?: string;
  };
  validation?: ValidationError[];
  context?: Record<string, string | number | boolean>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: string | number | boolean;
}

// Типы для конфигурации
export interface ServerConfig {
  port: number;
  host: string;
  corsOrigin: string | string[];
  workspaceDir: string;
  geminiApiKey: string;
  jwtSecret: string;
  nodeEnv: string;
  logLevel: string;
  maxFileSize: number;
  allowedFileExtensions: string[];
}

// Типы для middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email?: string;
  };
  session?: Session;
}

// Типы для событий
export interface AppEvent {
  type: string;
  timestamp: Date;
  source: string;
  data: AppEventData;
}

export interface AppEventData {
  message?: string;
  error?: Error;
  metadata?: Record<string, string | number | boolean>;
  payload?: FileEventData | TerminalEventData | ChatEventData;
}

export interface FileEventData {
  filePath: string;
  fileName: string;
  fileSize?: number;
  oldPath?: string;
  newPath?: string;
  content?: string;
  operation: 'create' | 'update' | 'delete' | 'rename';
}

export interface TerminalEventData {
  sessionId: string;
  command?: string;
  output?: string;
  exitCode?: number;
  pid?: number;
  workingDirectory?: string;
}

export interface ChatEventData {
  conversationId: string;
  messageId: string;
  content: string;
  sender: 'user' | 'ai';
  tokens?: number;
  duration?: number;
}

export interface FileWatchEvent extends AppEvent {
  type: 'file_created' | 'file_modified' | 'file_deleted' | 'file_renamed';
  filePath: string;
  oldPath?: string;
  data: AppEventData & {
    payload: FileEventData;
  };
}

export interface TerminalEvent extends AppEvent {
  type: 'terminal_started' | 'terminal_stopped' | 'terminal_output' | 'terminal_error';
  sessionId: string;
  data: AppEventData & {
    payload: TerminalEventData;
  };
}

export interface ChatEvent extends AppEvent {
  type: 'chat_message' | 'chat_response' | 'chat_error';
  conversationId: string;
  message: string;
  data: AppEventData & {
    payload: ChatEventData;
  };
}

// Utility types
export type WebSocketMessageType = 
  | ChatMessage 
  | ChatResponse 
  | ChatError 
  | TerminalOutput 
  | TerminalInput 
  | TerminalCommand 
  | TerminalStatus 
  | FileChange;

export type EventType = FileWatchEvent | TerminalEvent | ChatEvent; 