// API Response types matching backend implementation

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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export type FileContentApiResponse = ApiResponse<FileContent>;
export type FileListApiResponse = ApiResponse<FileInfo[]>; 