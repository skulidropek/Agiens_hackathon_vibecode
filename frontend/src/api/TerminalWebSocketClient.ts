import type {
  WebSocketCommand,
  WebSocketMessage,
} from '../types';

type MessageHandler = (message: WebSocketMessage) => void;

/**
 * Клиент для управления WebSocket-соединением для терминалов.
 */
export class TerminalWebSocketClient {
  private static instance: TerminalWebSocketClient;

  private ws: WebSocket | null = null;
  private messageHandler: MessageHandler | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectInterval = 3000;
  private commandQueue: WebSocketCommand[] = [];
  private listeners: MessageHandler[] = [];

  // Приватный конструктор
  private constructor() {}

  // Статический метод для получения экземпляра
  public static getInstance(): TerminalWebSocketClient {
    if (!TerminalWebSocketClient.instance) {
      TerminalWebSocketClient.instance = new TerminalWebSocketClient();
    }
    return TerminalWebSocketClient.instance;
  }

  public onMessage(handler: MessageHandler): void {
    console.log('TerminalWebSocketClient: Setting message handler', {
      hadPreviousHandler: !!this.messageHandler,
      timestamp: new Date().toISOString()
    });
    this.messageHandler = handler;
  }

  public connect(): void {
    // Если уже есть соединение в состояниях CONNECTING или OPEN – не создаём новое
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      console.log('🔄 Terminal WebSocket already connected/connecting, skipping', {
        readyState: this.ws.readyState,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = '127.0.0.1:3000';
    const wsUrl = `${protocol}//${host}/ws?type=terminal`;

    console.log('🔌 Connecting to Terminal WebSocket:', wsUrl, new Date().toISOString());
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ Terminal WebSocket connected', new Date().toISOString());
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
          console.log('Terminal WebSocket connection established with ID:', message.connectionId);
        }

        // Call the main message handler
        this.messageHandler?.(message);
        
        // Also notify all terminal listeners
        this.listeners.forEach(listener => {
          try {
            listener(message);
          } catch (error) {
            console.error('Error in terminal listener:', error);
          }
        });
      } catch (error) {
        console.error('Error parsing Terminal WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Terminal WebSocket error:', error);
    };

    this.ws.onclose = (event) => {
      console.log('🔌 Terminal WebSocket disconnected', {
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
      console.error('Max reconnect attempts reached for Terminal WebSocket. Giving up.');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * this.reconnectAttempts;
    console.log(`Reconnecting Terminal WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`, new Date().toISOString());

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting Terminal WebSocket reconnect now...', new Date().toISOString());
      this.connect();
    }, delay);
  }

  private sendCommand(command: WebSocketCommand): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('➡️  TerminalWebSocketClient: Sending command immediately', command, new Date().toISOString());
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('⏳ Terminal WebSocket not connected. Queuing command:', command, 'Current queue length:', this.commandQueue.length, new Date().toISOString());
      this.commandQueue.push(command);
    }
  }

  private processCommandQueue(): void {
    if (this.commandQueue.length === 0) {
      console.log('🟢 Terminal WebSocket command queue is empty. Nothing to process.', new Date().toISOString());
    }
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift();
      if (command) {
        console.log('🚚 Sending queued terminal command:', command, 'Remaining queue length:', this.commandQueue.length, new Date().toISOString());
        this.sendCommand(command);
      }
    }
  }

  public subscribeToTerminal(terminalId: string, onData: (data: string) => void, onHistory?: (history: Array<{type: string, data: string, timestamp: string}>) => void): () => void {
    const handler = (message: WebSocketMessage) => {
      if (message.type === 'terminal_output' && message.terminalId === terminalId) {
        onData(message.data);
      } else if (message.type === 'terminal_history' && message.sessionId === terminalId) {
        onHistory?.(message.history);
      }
    };
    this.listeners.push(handler);
    
    // Отправляем команду подписки на терминал
    this.sendCommand({ type: 'subscribe_terminal', payload: { terminalId } });

    return () => {
      // Отписываемся от терминала
      this.sendCommand({ type: 'unsubscribe_terminal', payload: { terminalId } });
      this.listeners = this.listeners.filter(l => l !== handler);
    };
  }

  public sendTerminalInput(terminalId: string, data: string) {
    // Отправляем ввод терминала
    this.sendCommand({ type: 'terminal_input', payload: { terminalId, data } });
  }

  public resizeTerminal(terminalId: string, size: { cols: number; rows: number }) {
    // Отправляем команду изменения размера
    this.sendCommand({ type: 'terminal_resize', payload: { terminalId, ...size } });
  }

  public subscribeToTerminalList(projectId?: string): void {
    this.sendCommand({ type: 'subscribe_terminal_list', payload: { projectId } });
  }

  public unsubscribeFromTerminalList(): void {
    this.sendCommand({ type: 'unsubscribe_terminal_list', payload: {} });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public forceReconnect(): void {
    console.log('🔄 TerminalWebSocketClient: Forcing reconnection', new Date().toISOString());
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