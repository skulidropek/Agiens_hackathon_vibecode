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
import { TerminalHandler } from './terminal-handler';
import { TerminalService, TerminalSession } from '../services/terminal-service';
import { ChatHandler } from './chat-handler';
import { ProjectChatService } from '../services/project-chat-service';
import { AppConfig } from '../config/app-config';

const connections = new Map<string, WebSocketConnection>();
const config = new AppConfig();
const projectService = new ProjectService(config.workspaceDir);
const projectChatService = new ProjectChatService(projectService);
const terminalService = new TerminalService(config, projectService);
const terminalHandler = new TerminalHandler(terminalService);
const chatHandler = new ChatHandler(projectChatService);

// Функция для отправки обновлений списка терминалов всем подписчикам
function broadcastTerminalListUpdate(projectId?: string): void {
  const terminals = projectId ? terminalService.getSessionsByProject(projectId) : terminalService.getAllSessions();
  const terminalList = terminals.map((session: TerminalSession) => ({
    id: session.id,
    command: session.command,
    projectId: session.projectId,
    cwd: session.cwd,
    startTime: session.startTime.toISOString(),
    lastActivity: session.lastActivity.toISOString(),
    isActive: session.isActive,
    pid: session.pid
  }));

  connections.forEach((connection) => {
    if (connection.terminalListSubscriber && connection.ws.readyState === connection.ws.OPEN) {
      // Если подписчик фильтрует по projectId, отправляем только соответствующие терминалы
      if (connection.terminalListProjectId) {
        const filteredTerminals = terminalList.filter(t => t.projectId === connection.terminalListProjectId);
        sendMessage(connection.ws, {
          type: 'terminal_list_update',
          terminals: filteredTerminals,
          timestamp: new Date().toISOString()
        });
      } else {
        // Отправляем все терминалы
        sendMessage(connection.ws, {
          type: 'terminal_list_update',
          terminals: terminalList,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
}

// Устанавливаем callback для обновления списка терминалов
terminalService.onTerminalListUpdate = broadcastTerminalListUpdate;

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
            // Проверяем формат сообщения: если есть payload, используем новый обработчик
            if ('payload' in message && typeof message.payload === 'object' && message.payload !== null) {
              await handleTerminalInputWithPayload(connection, message as { type: string; payload: { terminalId: string; data: string } });
            } else {
              await handleTerminalInput(connection, message as TerminalInput);
            }
            break;
          
          case 'terminal_command':
            await handleTerminalCommand(connection, message as TerminalCommand);
            break;
          
          case 'subscribe_terminal':
            await handleTerminalSubscription(connection, message as { type: string; payload: { terminalId: string } });
            break;
          
          case 'unsubscribe_terminal':
            await handleTerminalUnsubscription(connection, message as { type: string; payload: { terminalId: string } });
            break;
          
          case 'terminal_resize':
            await handleTerminalResize(connection, message as { type: string; payload: { terminalId: string; cols: number; rows: number } });
            break;
          
          case 'subscribe_terminal_list':
            await handleTerminalListSubscription(connection, message as { type: string; payload: { projectId?: string } });
            break;
          
          case 'unsubscribe_terminal_list':
            await handleTerminalListUnsubscription(connection, message as { type: string; payload: Record<string, never> });
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
      if (connection.type === 'terminal') {
        terminalHandler.handleConnectionClose(connection);
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

// Обработка ввода в терминал через payload
async function handleTerminalInputWithPayload(connection: WebSocketConnection, message: { type: string; payload: { terminalId: string; data: string } }): Promise<void> {
  try {
    const { terminalId, data } = message.payload;
    
    if (!terminalId) {
      throw new Error('Terminal ID required for terminal input');
    }

    logger.debug('Processing terminal input via payload', {
      connectionId: connection.id,
      terminalId,
      dataLength: data.length
    });

    // Создаем объект в формате TerminalInput для передачи в terminalHandler
    const terminalInput: TerminalInput = {
      type: 'terminal_input',
      sessionId: terminalId,
      data,
      timestamp: new Date().toISOString(),
      id: `terminal-input-${Date.now()}`
    };

    // Подписываем соединение на терминал если еще не подписано
    terminalHandler.subscribeToSession(terminalId, connection);

    await terminalHandler.handleInput(connection, terminalInput);

  } catch (error) {
    logger.error('Error handling terminal input with payload', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to process terminal input', 'TERMINAL_ERROR');
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

// Обработка подписки на терминал
async function handleTerminalSubscription(connection: WebSocketConnection, message: { type: string; payload: { terminalId: string } }): Promise<void> {
  try {
    const { terminalId } = message.payload;
    
    if (!terminalId) {
      throw new Error('Terminal ID required for subscription');
    }

    logger.info('Processing terminal subscription', {
      connectionId: connection.id,
      terminalId
    });

    // Подписываем соединение на терминал
    terminalHandler.subscribeToSession(terminalId, connection);

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'terminal_event',
      terminalId,
      event: 'subscribed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling terminal subscription', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to subscribe to terminal', 'TERMINAL_ERROR');
  }
}

// Обработка отписки от терминала
async function handleTerminalUnsubscription(connection: WebSocketConnection, message: { type: string; payload: { terminalId: string } }): Promise<void> {
  try {
    const { terminalId } = message.payload;
    
    if (!terminalId) {
      throw new Error('Terminal ID required for unsubscription');
    }

    logger.info('Processing terminal unsubscription', {
      connectionId: connection.id,
      terminalId
    });

    // Отписываем соединение от терминала
    terminalHandler.unsubscribeFromSession(terminalId, connection);

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'terminal_event',
      terminalId,
      event: 'unsubscribed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling terminal unsubscription', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to unsubscribe from terminal', 'TERMINAL_ERROR');
  }
}

// Обработка изменения размера терминала
async function handleTerminalResize(connection: WebSocketConnection, message: { type: string; payload: { terminalId: string; cols: number; rows: number } }): Promise<void> {
  try {
    const { terminalId, cols, rows } = message.payload;
    
    if (!terminalId) {
      throw new Error('Terminal ID required for resize');
    }

    if (!cols || !rows || cols < 1 || rows < 1) {
      throw new Error('Valid cols and rows required for resize');
    }

    logger.info('Processing terminal resize', {
      connectionId: connection.id,
      terminalId,
      cols,
      rows
    });

    // Изменяем размер терминала
    await terminalHandler.handleResize(connection, terminalId, cols, rows);

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'terminal_event',
      terminalId,
      event: 'resized',
      data: { cols, rows },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling terminal resize', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    
    sendErrorMessage(connection.ws, 'Failed to resize terminal', 'TERMINAL_ERROR');
  }
}

// Обработка запуска файлового watcher
async function handleFileWatchStart(connection: WebSocketConnection, message: FileWatchStart, fileWatcherService: FileWatcherService): Promise<void> {
  try {
    if (connection.type !== 'files') {
      throw new Error('File watch messages only allowed on files connections');
    }

    // Извлекаем projectId из payload (совместимость с фронтендом)
    const projectId = (message as unknown as {payload?: {projectId?: string}}).payload?.projectId || message.projectId;
    
    if (!projectId) {
      throw new Error('projectId is required');
    }

    logger.info('Starting file watch', {
      connectionId: connection.id,
      projectId: projectId,
    });

    // Запускаем watcher для проекта
    await fileWatcherService.startWatching({
      projectId: projectId,
      connectionId: connection.id,
      ignoreInitial: false
    });

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'file_watch_started',
      projectId: projectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const projectId = (message as unknown as {payload?: {projectId?: string}}).payload?.projectId || message.projectId;
    logger.error('Error starting file watch', {
      connectionId: connection.id,
      projectId: projectId,
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

    // Извлекаем projectId из payload (совместимость с фронтендом)
    const projectId = (message as unknown as {payload?: {projectId?: string}}).payload?.projectId || message.projectId;
    
    if (!projectId) {
      throw new Error('projectId is required');
    }

    logger.info('Stopping file watch', {
      connectionId: connection.id,
      projectId: projectId,
    });

    // Останавливаем watcher для проекта
    fileWatcherService.stopWatching(projectId);

    // Отправляем подтверждение
    sendMessage(connection.ws, {
      type: 'file_watch_stopped',
      projectId: projectId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const projectId = (message as unknown as {payload?: {projectId?: string}}).payload?.projectId || message.projectId;
    logger.error('Error stopping file watch', {
      connectionId: connection.id,
      projectId: projectId,
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

// Обработка подписки на список терминалов
async function handleTerminalListSubscription(connection: WebSocketConnection, message: { type: string; payload: { projectId?: string } }): Promise<void> {
  try {
    if (connection.type !== 'terminal') {
      throw new Error('Terminal list subscription only allowed on terminal connections');
    }

    const { projectId } = message.payload;
    
    logger.info('Terminal list subscription', {
      connectionId: connection.id,
      projectId: projectId || 'all',
    });

    // Добавляем соединение в список подписчиков на обновления терминалов
    connection.terminalListSubscriber = true;
    connection.terminalListProjectId = projectId;

    // Отправляем текущий список терминалов
    const terminals = projectId ? terminalService.getSessionsByProject(projectId) : terminalService.getAllSessions();
    sendMessage(connection.ws, {
      type: 'terminal_list_update',
      terminals: terminals.map((session: TerminalSession) => ({
        id: session.id,
        command: session.command,
        projectId: session.projectId,
        cwd: session.cwd,
        startTime: session.startTime.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
        isActive: session.isActive,
        pid: session.pid
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error handling terminal list subscription', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    sendErrorMessage(connection.ws, 'Failed to subscribe to terminal list', 'TERMINAL_LIST_SUBSCRIPTION_ERROR');
  }
}

// Обработка отписки от списка терминалов
async function handleTerminalListUnsubscription(connection: WebSocketConnection, _message: { type: string; payload: Record<string, never> }): Promise<void> {
  try {
    if (connection.type !== 'terminal') {
      throw new Error('Terminal list unsubscription only allowed on terminal connections');
    }

    logger.info('Terminal list unsubscription', {
      connectionId: connection.id,
    });

    // Удаляем соединение из списка подписчиков
    connection.terminalListSubscriber = false;
    connection.terminalListProjectId = undefined;

  } catch (error) {
    logger.error('Error handling terminal list unsubscription', {
      connectionId: connection.id,
      error: error instanceof Error ? error.message : String(error)
    });
    sendErrorMessage(connection.ws, 'Failed to unsubscribe from terminal list', 'TERMINAL_LIST_UNSUBSCRIPTION_ERROR');
  }
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