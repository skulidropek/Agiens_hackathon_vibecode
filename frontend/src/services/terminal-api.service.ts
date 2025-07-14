import { Api } from '../api/Api';
import { ContentType } from '../api/http-client';

export interface TerminalSession {
  id: string;
  projectId: string;
  command?: string;
  isActive: boolean;
  pid: number;
  cwd: string;
  createdAt: string;
  lastActivity: string;
}

export interface CreateTerminalRequest {
  projectId: string;
  command?: string;
  cwd?: string;
}

export interface TerminalResponse {
  success: boolean;
  data: TerminalSession;
  message?: string;
}

export interface TerminalListResponse {
  success: boolean;
  data: TerminalSession[];
  message?: string;
}

export class TerminalApiService {
  private api: Api;

  constructor() {
    this.api = new Api({
      baseUrl: 'http://localhost:3000'
    });
  }

  async getTerminals(projectId: string): Promise<TerminalSession[]> {
    try {
      const response = await this.api.request<TerminalListResponse>({
        path: `/api/terminals?projectId=${projectId}`,
        method: 'GET',
      });
      return response.data?.data || [];
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
      return [];
    }
  }

  async createTerminal(request: CreateTerminalRequest): Promise<TerminalSession | null> {
    try {
      const response = await this.api.request<TerminalResponse>({
        path: '/api/terminals',
        method: 'POST',
        body: request,
        type: ContentType.Json,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to create terminal:', error);
      return null;
    }
  }

  async deleteTerminal(sessionId: string): Promise<boolean> {
    try {
      await this.api.request({
        path: `/api/terminals/${sessionId}`,
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('Failed to delete terminal:', error);
      return false;
    }
  }

  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<boolean> {
    try {
      await this.api.request({
        path: `/api/terminals/${sessionId}/resize`,
        method: 'POST',
        body: { cols, rows },
        type: ContentType.Json,
      });
      return true;
    } catch (error) {
      console.error('Failed to resize terminal:', error);
      return false;
    }
  }
}

export const terminalApiService = new TerminalApiService(); 