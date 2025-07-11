import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { 
  ApiResponse, 
  ChatMessage, 
  Session 
} from '../types';
import { 
  asyncHandler, 
  ValidationError 
} from '../middleware/error-handler';

// Простое хранилище сессий в памяти (в продакшене используйте Redis)
const sessions = new Map<string, Session>();
const chatHistory = new Map<string, ChatMessage[]>();

export const setupChatRoutes = (): Router => {
  const router = Router();

  // POST /api/chat/sessions - создать новую сессию
  router.post('/sessions', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.body;
    
    const sessionId = uuidv4();
    const conversationId = uuidv4();
    
    const session: Session = {
      id: sessionId,
      userId: userId || 'anonymous',
      conversationId,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    sessions.set(sessionId, session);
    chatHistory.set(conversationId, []);

    logger.info('New chat session created', { sessionId, conversationId, userId });

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
      message: 'Session created successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // GET /api/chat/sessions/:sessionId - получить информацию о сессии
  router.get('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }

    const session = sessions.get(sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId', sessionId);
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // GET /api/chat/sessions/:sessionId/history - получить историю чата
  router.get('/sessions/:sessionId/history', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    if (!sessionId) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }

    const session = sessions.get(sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId', sessionId);
    }

    const history = chatHistory.get(session.conversationId) || [];
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const paginatedHistory = history
      .slice(offsetNum, offsetNum + limitNum)
      .reverse(); // Показываем последние сообщения первыми

    const response: ApiResponse<{
      messages: ChatMessage[];
      total: number;
      limit: number;
      offset: number;
    }> = {
      success: true,
      data: {
        messages: paginatedHistory,
        total: history.length,
        limit: limitNum,
        offset: offsetNum
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // DELETE /api/chat/sessions/:sessionId - завершить сессию
  router.delete('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }

    const session = sessions.get(sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId', sessionId);
    }

    // Помечаем сессию как неактивную
    session.isActive = false;
    sessions.set(sessionId, session);

    logger.info('Chat session ended', { sessionId });

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Session ended successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // GET /api/chat/sessions - получить список активных сессий
  router.get('/sessions', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, active = 'true' } = req.query;
    const isActiveFilter = active === 'true';

    let filteredSessions = Array.from(sessions.values());

    if (userId) {
      filteredSessions = filteredSessions.filter(session => session.userId === userId);
    }

    if (isActiveFilter) {
      filteredSessions = filteredSessions.filter(session => session.isActive);
    }

    // Сортируем по последней активности
    filteredSessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    const response: ApiResponse<Session[]> = {
      success: true,
      data: filteredSessions,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // POST /api/chat/sessions/:sessionId/messages - добавить сообщение в историю (для внешнего использования)
  router.post('/sessions/:sessionId/messages', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { content, sender } = req.body;

    if (!sessionId) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }

    if (!content) {
      throw new ValidationError('Message content is required', 'content');
    }

    if (!sender || !['user', 'ai'].includes(sender)) {
      throw new ValidationError('Sender must be either "user" or "ai"', 'sender');
    }

    const session = sessions.get(sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId', sessionId);
    }

    const message: ChatMessage = {
      type: 'chat_message',
      content,
      sender,
      conversationId: session.conversationId,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    // Добавляем сообщение в историю
    const history = chatHistory.get(session.conversationId) || [];
    history.push(message);
    chatHistory.set(session.conversationId, history);

    // Обновляем активность сессии
    session.lastActivity = new Date();
    sessions.set(sessionId, session);

    logger.info('Message added to chat history', { 
      sessionId, 
      messageId: message.id, 
      sender 
    });

    const response: ApiResponse<ChatMessage> = {
      success: true,
      data: message,
      message: 'Message added successfully',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  return router;
};

// Экспортируем функции для использования в WebSocket
export const addMessageToHistory = (conversationId: string, message: ChatMessage): void => {
  const history = chatHistory.get(conversationId) || [];
  history.push(message);
  chatHistory.set(conversationId, history);
};

export const getSessionByConversationId = (conversationId: string): Session | undefined => {
  return Array.from(sessions.values()).find(session => session.conversationId === conversationId);
};

export const updateSessionActivity = (sessionId: string): void => {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = new Date();
    sessions.set(sessionId, session);
  }
};

export const getActiveSessionsCount = (): number => {
  return Array.from(sessions.values()).filter(session => session.isActive).length;
};

export const cleanupInactiveSessions = (): void => {
  const now = new Date();
  const inactiveThreshold = 30 * 60 * 1000; // 30 минут

  for (const [sessionId, session] of sessions) {
    if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
      session.isActive = false;
      sessions.set(sessionId, session);
      logger.info('Session marked as inactive due to timeout', { sessionId });
    }
  }
};

// Запускаем очистку неактивных сессий каждые 5 минут
setInterval(cleanupInactiveSessions, 5 * 60 * 1000); 