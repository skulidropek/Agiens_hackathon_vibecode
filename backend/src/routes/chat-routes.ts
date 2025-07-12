import { Router, Request, Response } from 'express';
import { 
  ApiResponse, 
  ChatMessage, 
  Session 
} from '../types';
import { 
  asyncHandler, 
  ValidationError 
} from '../middleware/error-handler';
import { ProjectChatService } from '../services/project-chat-service';

export const setupChatRoutes = (projectChatService: ProjectChatService): Router => {
  const router = Router();

  /**
   * @openapi
   * /api/chat/sessions:
   *   get:
   *     summary: Получить список всех сессий
   *     tags:
   *       - Chat
   *     responses:
   *       200:
   *         description: Список сессий
   */
  // GET /api/chat/sessions - получить все сессии
  router.get('/sessions', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, active = 'true', projectId } = req.query;
    if (!projectId) throw new ValidationError('projectId required', 'projectId');
    const isActiveFilter = active === 'true';
    const sessions = await projectChatService.loadSessions(projectId as string);
    const filteredSessions = (() => {
      let arr = sessions;
      if (userId) arr = arr.filter(session => session.userId === userId);
      if (isActiveFilter) arr = arr.filter(session => session.isActive);
      arr.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
      return arr;
    })();
    const response: ApiResponse<Session[]> = {
      success: true,
      data: filteredSessions,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  }));

  /**
   * @openapi
   * /api/chat/sessions/{id}:
   *   get:
   *     summary: Получить сессию по ID
   *     tags:
   *       - Chat
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID сессии
   *     responses:
   *       200:
   *         description: Сессия
   */
  // GET /api/chat/sessions/:id - получить сессию по ID
  router.get('/sessions/:sessionId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { projectId } = req.query;
    if (!sessionId) throw new ValidationError('Session ID is required', 'sessionId');
    if (!projectId) throw new ValidationError('projectId required', 'projectId');
    const sessions = await projectChatService.loadSessions(projectId as string);
    const session = sessions.find((s: Session) => s.id === sessionId);
    if (!session) throw new ValidationError('Session not found', 'sessionId', sessionId);
    const response: ApiResponse<Session> = {
      success: true,
      data: session,
      timestamp: new Date().toISOString()
    };
    res.json(response);
  }));

  /**
   * @openapi
   * /api/chat/sessions/{sessionId}/history:
   *   get:
   *     summary: Получить историю чата по сессии
   *     tags:
   *       - Chat
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID сессии
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Количество сообщений (по умолчанию 50)
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *         description: Смещение (по умолчанию 0)
   *     responses:
   *       200:
   *         description: История сообщений
   */
  // GET /api/chat/sessions/:sessionId/history - получить историю чата
  router.get('/sessions/:sessionId/history', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    if (!sessionId) {
      throw new ValidationError('Session ID is required', 'sessionId');
    }

    const { projectId } = req.query;
    if (!projectId) throw new ValidationError('projectId required', 'projectId');
    const sessions = await projectChatService.loadSessions(projectId as string);
    const session = sessions.find((s: Session) => s.id === sessionId);
    if (!session) {
      throw new ValidationError('Session not found', 'sessionId', sessionId);
    }

    const history = await projectChatService.loadHistory(projectId as string, session!.conversationId);
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

  return router;
};