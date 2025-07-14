import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { 
  WebSocketConnection, 
  WebSocketMessageType, 
  ChatMessage, 
  TerminalInput, 
  TerminalCommand,
  WebSocketLike,
  FileWatchStart,
  FileWatchStop
} from '../types';
import { FileWatcherService } from '../services/file-watcher-service';
import { ProjectService } from '../services/project-service';
// import { ChatHandler } from './chat-handler';
// import { TerminalHandler } from './terminal-handler';

const connections = new Map<string, WebSocketConnection>();

// Временные заглушки для обработчиков
const chatHandler = {
  processMessage: async (connection: WebSocketConnection, message: ChatMessage): Promise<void> => {
    logger.info('Chat message received (stub)', { message: message.content });
    // Заглушка - просто отправляем подтверждение
    if (connection.ws.readyState === connection.ws.OPEN) {
      connection.ws.send(JSON.stringify({
        type: 'chat_response',
        content: `Получено сообщение: ${message.content}`,
        sender: 'ai',
        timestamp: new Date().toISOString()
      }));
    }
  }
};

const terminalHandler = {
  handleInput: async (connection: WebSocketConnection, message: TerminalInput): Promise<void> => {
    logger.info('Terminal input received (stub)', { input: message.data });
  },
  handleCommand: async (connection: WebSocketConnection, message: TerminalCommand): Promise<void> => {
    logger.info('Terminal command received (stub)', { command: message.command });
  },
  closeSession: (sessionId: string): void => {
    logger.info('Terminal session closed (stub)', { sessionId });
  }
};

export const setupWebSocketRoutes = (wss: WebSocketServer, projectService: ProjectService, fileWatcherService: FileWatcherService): void => {
  wss.on('connection', (ws, req) => {
    const connectionId = uuidv4();
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const connectionType = url.searchParams.get('type') as 'chat' | 'terminal' | 'files' || 'chat';
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    // Создаем объект соединения
    const connection: WebSocketConnection = {
      ws,
      id: connectionId,
      type: connectionType,
      sessionId: sessionId || undefined,
      userId: userId || undefined,
      isAlive: true,
      lastPing: new Date()
    };

    connections.set(connectionId, connection);

    logger.info('New WebSocket connection', {
      connectionId,
      type: connectionType,
      sessionId,
      userId,
      totalConnections: connections.size
    });

    // Отправляем приветственное сообщение
    sendMessage(ws, {
      type: 'connection_established',
      connectionId,
      timestamp: new Date().toISOString()
    });

    // Настраиваем обработчики сообщений
    ws.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as WebSocketMessageType;
        
        logger.debug('Received WebSocket message', {
          connectionId,
          type: message.type,
          sessionId: connection.sessionId
        });

        // Обновляем активность соединения
        connection.isAlive = true;
        connection.lastPing = new Date();

        // Обновляем активность сессии если есть
        if (connection.sessionId) {
          // updateSessionActivity(connection.sessionId); // This line is removed
        }

        // Маршрутизация сообщений по типу
        switch (message.type) {
          case 'chat_message':
            await handleChatMessage(connection, message as ChatMessage);
            break;
          
          case 'terminal_input':
            await handleTerminalInput(connection, message as TerminalInput);
            break;
          
          case 'terminal_command':
            await handleTerminalCommand(connection, message as TerminalCommand);
            break;
          
          case 'file_watch_start':
            await handleFileWatchStart(connection, message as FileWatchStart, fileWatcherService);
            break;
          
          case 'file_watch_stop':
            await handleFileWatchStop(connection, message as FileWatchStop, fileWatcherService);
            break;
          
          default:
            logger.warn('Unknown message type', {
              connectionId,
              type: message.type
            });
            sendErrorMessage(ws, 'Unknown message type', 'UNKNOWN_MESSAGE_TYPE');
        }
      } catch (error) {
        logger.error('Error processing WebSocket message', {
          connectionId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        sendErrorMessage(ws, 'Failed to process message', 'MESSAGE_PROCESSING_ERROR');
      }
    });

    // Обработка закрытия соединения
    ws.on('close', (code, reason) => {
      logger.info('WebSocket connection closed', {
        connectionId,
        code,
        reason: reason.toString(),
        remainingConnections: connections.size - 1
      });

      // Завершаем терминальные сессии при закрытии соединения
      if (connection.type === 'terminal' && connection.sessionId) {
        terminalHandler.closeSession(connection.sessionId);
      }

      connections.delete(connectionId);
    });

    // Обработка ошибок
    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        connectionId,
        error: error.message
      });
      
      connections.delete(connectionId);
    });

    // Обработка пинга
    ws.on('pong', () => {
      connection.isAlive = true;
      connection.lastPing = new Date();
    });
  });

  // Настраиваем ping/pong для проверки живых соединений
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const connection = Array.from(connections.values()).find(conn => conn.ws === ws);
      
      if (connection) {
        if (!connection.isAlive) {
          logger.info('Terminating inactive WebSocket connection', {
            connectionId: connection.id
          });
          ws.terminate();
          connections.delete(connection.id);
          return;
        }
        
        connection.isAlive = false;
        ws.ping();
      }
    });
  }, 30000); // Проверяем каждые 30 секунд

  // Очищаем интервал при остановке сервера
  wss.on('close', () => {
    clearInterval(pingInterval);
  });
};

// Обработка сообщений чата
async function handleChatMessage(connection: WebSocketConnection, message: ChatMessage): Promise<void> {
  try {
    if (connection.type !== 'chat') {
      throw new Error('Chat messages only allowed on chat connections');
    }

    if (!connection.sessionId) {
      throw new Error('Session ID required for chat messages');
    }

    logger.info('Processing chat message', {
      connectionId: connection.id,
      sessionId: connection.sessionId,
      sender: message.sender,
      contentLength: message.content.length
    });

    // Сохраняем сообщение пользователя в истории
    if (message.conversationId) {
      // addMessageToHistory(message.conversationId, message); // This line is removed
    }

    // Отправляем сообщение в AI обработчик
    await chatHandler.processMessage(connection, message);

  } catch (error) {
    logger.error('Error handling chat message', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to process chat message', 'CHAT_ERROR');
  }
}

// Обработка ввода в терминал
async function handleTerminalInput(connection: WebSocketConnection, message: TerminalInput): Promise<void> {
  try {
    if (connection.type !== 'terminal') {
      throw new Error('Terminal input only allowed on terminal connections');
    }

    if (!connection.sessionId) {
      throw new Error('Session ID required for terminal input');
    }

    logger.debug('Processing terminal input', {
      connectionId: connection.id,
      sessionId: connection.sessionId,
      dataLength: message.data.length
    });

    await terminalHandler.handleInput(connection, message);

  } catch (error) {
    logger.error('Error handling terminal input', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to process terminal input', 'TERMINAL_ERROR');
  }
}

// Обработка команд терминала
async function handleTerminalCommand(connection: WebSocketConnection, message: TerminalCommand): Promise<void> {
  try {
    if (connection.type !== 'terminal') {
      throw new Error('Terminal commands only allowed on terminal connections');
    }

    if (!connection.sessionId) {
      throw new Error('Session ID required for terminal commands');
    }

    logger.info('Processing terminal command', {
      connectionId: connection.id,
      sessionId: connection.sessionId,
      command: message.command
    });

    await terminalHandler.handleCommand(connection, message);

  } catch (error) {
    logger.error('Error handling terminal command', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to process terminal command', 'TERMINAL_ERROR');
  }
}

// Обработка запуска файлового watcher
async function handleFileWatchStart(connection: WebSocketConnection, message: FileWatchStart, fileWatcherService: FileWatcherService): Promise<void> {
  try {
    if (connection.type !== 'files') {
      throw new Error('File watch messages only allowed on files connections');
    }

    logger.info('Starting file watch', {
      connectionId: connection.id,
      projectId: message.projectId,
    });

    // Запускаем watcher для проекта
    await fileWatcherService.startWatching({
      projectId: message.projectId,
      connectionId: connection.id,
      ignoreInitial: false
    });

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'file_watch_started',
      projectId: message.projectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error starting file watch', {
      connectionId: connection.id,
      projectId: message.projectId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to start file watch', 'FILE_WATCH_ERROR');
  }
}

// Обработка остановки файлового watcher
async function handleFileWatchStop(connection: WebSocketConnection, message: FileWatchStop, fileWatcherService: FileWatcherService): Promise<void> {
  try {
    if (connection.type !== 'files') {
      throw new Error('File watch messages only allowed on files connections');
    }

    logger.info('Stopping file watch', {
      connectionId: connection.id,
      projectId: message.projectId,
    });

    // Останавливаем watcher для проекта
    fileWatcherService.stopWatching(message.projectId);

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'file_watch_stopped',
      projectId: message.projectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error stopping file watch', {
      connectionId: connection.id,
      projectId: message.projectId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to stop file watch', 'FILE_WATCH_ERROR');
  }
}

// Утилиты для отправки сообщений
function sendMessage(ws: WebSocketLike, message: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendErrorMessage(ws: WebSocketLike, message: string, code: string): void {
  sendMessage(ws, {
    type: 'error',
    error: message,
    code,
    timestamp: new Date().toISOString()
  });
}

// Экспортируем функции для использования в других модулях
export const broadcastToType = (type: WebSocketConnection['type'], message: Record<string, unknown>): void => {
  connections.forEach((connection) => {
    if (connection.type === type && connection.ws.readyState === connection.ws.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  });
};

export const sendToConnection = (connectionId: string, message: Record<string, unknown>): boolean => {
  const connection = connections.get(connectionId);
  if (connection && connection.ws.readyState === connection.ws.OPEN) {
    connection.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
};

export const getConnectionsByType = (type: WebSocketConnection['type']): WebSocketConnection[] => {
  return Array.from(connections.values()).filter(conn => conn.type === type);
};

export const getConnectionsCount = (): number => {
  return connections.size;
};

export const getConnectionById = (connectionId: string): WebSocketConnection | undefined => {
  return connections.get(connectionId);
}; 