export interface TerminalWebSocketMessage {
  type: 'terminal_output' | 'terminal_input' | 'terminal_resize' | 'terminal_exit' | 'connection_established' | 'error';
  sessionId?: string;
  data?: string;
  cols?: number;
  rows?: number;
  connectionId?: string;
  error?: string;
  code?: string;
}

export class TerminalWebSocketService {
  private connections = new Map<string, WebSocket>();

  public connect(sessionId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      // Close existing connection if any
      this.disconnect(sessionId);

      const wsUrl = `ws://localhost:3000/ws?type=terminal&sessionId=${sessionId}`;
      console.log(`🔌 Connecting terminal WebSocket for session ${sessionId}:`, wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log(`✅ Terminal WebSocket connected for session ${sessionId}`);
        this.connections.set(sessionId, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        console.error(`❌ Terminal WebSocket error for session ${sessionId}:`, error);
        reject(error);
      };

      ws.onclose = (event) => {
        console.log(`🔌 Terminal WebSocket closed for session ${sessionId}`, {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.connections.delete(sessionId);
      };
    });
  }

  public disconnect(sessionId: string): void {
    const ws = this.connections.get(sessionId);
    if (ws) {
      ws.close();
      this.connections.delete(sessionId);
    }
  }

  public sendInput(sessionId: string, data: string): boolean {
    const ws = this.connections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'terminal_input',
        sessionId,
        data
      }));
      return true;
    }
    return false;
  }

  public sendResize(sessionId: string, cols: number, rows: number): boolean {
    const ws = this.connections.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'terminal_resize',
        sessionId,
        cols,
        rows
      }));
      return true;
    }
    return false;
  }

  public onMessage(sessionId: string, handler: (message: TerminalWebSocketMessage) => void): void {
    const ws = this.connections.get(sessionId);
    if (ws) {
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as TerminalWebSocketMessage;
          handler(message);
        } catch (error) {
          console.error('Failed to parse terminal WebSocket message:', error);
        }
      };
    }
  }

  public isConnected(sessionId: string): boolean {
    const ws = this.connections.get(sessionId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  public disconnectAll(): void {
    this.connections.forEach((ws, sessionId) => {
      console.log(`Disconnecting terminal WebSocket for session ${sessionId}`);
      ws.close();
    });
    this.connections.clear();
  }
}

export const terminalWebSocketService = new TerminalWebSocketService(); 