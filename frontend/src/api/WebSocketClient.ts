import type {
  WebSocketCommand,
  WebSocketMessage,
} from '../types';

type MessageHandler = (message: WebSocketMessage) => void;

/**
 * Клиент для управления WebSocket-соединением для файловых операций.
 */
export class WebSocketClient {
  private static instance: WebSocketClient; // Статическое свойство для хранения единственного экземпляра

  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectInterval = 3000;
  private commandQueue: WebSocketCommand[] = [];

  // Приватный конструктор, чтобы предотвратить создание через `new`
  private constructor() {}

  // Статический метод для получения экземпляра
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  public onMessage(handler: MessageHandler): void {
    console.log('WebSocketClient: Setting message handler', {
      hadPreviousHandler: !!this.messageHandler,
      timestamp: new Date().toISOString()
    });
    this.messageHandler = handler;
  }

  public connect(): void {
    // Если уже есть соединение в состояниях CONNECTING или OPEN – не создаём новое
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔄 WebSocket already connected/connecting, skipping', {
        readyState: this.ws.readyState,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:3000'; // Явно используем IPv4 для избежания проблем с dual-stack
    const wsUrl = `${protocol}//${host}/ws?type=files`;

    console.log('🔌 Connecting to WebSocket:', wsUrl, new Date().toISOString());
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected', new Date().toISOString());
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      // Process any queued commands
      this.processCommandQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        
        if (message.type === 'connection_established') {
          console.log('Connection established with ID:', message.connectionId);
        }

        this.messageHandler?.(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: new Date().toISOString()
      });
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached. Giving up.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`, new Date().toISOString());

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting WebSocket reconnect now...', new Date().toISOString());
      this.connect();
    }, delay);
  }

  private sendCommand(command: WebSocketCommand): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('➡️  WebSocketClient: Sending command immediately', command, new Date().toISOString());
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('⏳ WebSocket not connected. Queuing command:', command, 'Current queue length:', this.commandQueue.length, new Date().toISOString());
      this.commandQueue.push(command);
    }
  }

  private processCommandQueue(): void {
    if (this.commandQueue.length === 0) {
      console.log('🟢 Command queue is empty. Nothing to process.', new Date().toISOString());
    }
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command) {
        console.log('🚚 Sending queued command:', command, 'Remaining queue length:', this.commandQueue.length, new Date().toISOString());
        this.sendCommand(command);
      }
    }
  }

  public startWatching(projectId: string): void {
    console.log('📤 WebSocketClient: Sending file_watch_start command for project:', projectId, new Date().toISOString());
    this.sendCommand({
      type: 'file_watch_start',
      projectId,
    });
  }

  public stopWatching(projectId: string): void {
    this.sendCommand({ type: 'file_watch_stop', projectId });
  }

  public getFileContent(filePath: string): Promise<string> {
    // Эта операция выполняется через REST API, а не WebSocket
    // но для консистентности можно оставить заглушку или проксировать
    console.log(`[WebSocketClient] getFileContent called for: ${filePath}, but should be handled by REST.`);
    return Promise.reject('getFileContent should be handled via REST API');
  }

  public saveFileContent(filePath: string, content: string): void {
    this.sendCommand({
      type: 'file_save_content',
      filePath,
      content,
    });
  }
  
  public createFile(filePath: string, content?: string): void {
    this.sendCommand({
      type: 'file_create',
      filePath,
      content: content ?? '',
    });
  }

  public deleteFile(filePath: string): void {
    this.sendCommand({ type: 'file_delete', filePath });
  }

  public renameFile(oldPath: string, newPath: string): void {
    console.log('📁 WebSocketClient: Sending rename file command', { from: oldPath, to: newPath, timestamp: new Date().toISOString() });
    this.sendCommand({
      type: 'file_rename',
      oldPath,
      newPath
    });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public forceReconnect(): void {
    console.log('🔄 WebSocketClient: Forcing reconnection', new Date().toISOString());
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
} 