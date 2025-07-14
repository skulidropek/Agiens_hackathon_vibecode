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

export interface FileWatchStartCommand {
  type: 'file_watch_start';
  projectId: string;
}

export interface FileWatchStopCommand {
  type: 'file_watch_stop';
  projectId: string;
}

export interface FileSaveContentCommand {
  type: 'file_save_content';
  filePath: string;
  content: string;
}

export interface FileCreateCommand {
  type: 'file_create';
  filePath: string;
  content: string;
}

export interface FileDeleteCommand {
  type: 'file_delete';
  filePath: string;
}

export interface FileRenameCommand {
  type: 'file_rename';
  oldPath: string;
  newPath: string;
}

export type WebSocketCommand =
  | FileWatchStartCommand
  | FileWatchStopCommand
  | FileSaveContentCommand
  | FileCreateCommand
  | FileDeleteCommand
  | FileRenameCommand;

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

export type WebSocketMessage =
  | ConnectionEstablishedMessage
  | FileWatchStartedMessage
  | ErrorMessage
  | FileEventMessage; 