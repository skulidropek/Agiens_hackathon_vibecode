import { Router, Request, Response } from 'express';
import { ProjectAIService, ProjectAIOptions } from '../services/project-ai-service';
import { logger } from '../utils/logger';
import { ProjectChatService } from '../services/project-chat-service';
import { ChatMessage, Session } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function setupProjectAIRoutes(projectAIService: ProjectAIService) {
  const router = Router();

  /**
   * @openapi
   * /api/projects/{projectId}/init:
   *   post:
   *     summary: Инициализация AI сервиса для проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: AI сервис инициализирован
   */
  router.post('/:projectId/init', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const options: Omit<ProjectAIOptions, 'projectId'> = req.body;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      await projectAIService.initialize({ projectId, ...options });
      
      res.json({
        success: true,
        message: 'Project AI сервис успешно инициализирован',
        projectId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error initializing Project AI service:', error instanceof Error ? error.message : String(error));
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @openapi
   * /api/projects/{projectId}/chat:
   *   post:
   *     summary: Чат с AI в контексте проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Ответ AI
   */
  router.post('/:projectId/chat', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { message, options } = req.body;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Поле message обязательно и должно быть строкой',
          timestamp: new Date().toISOString(),
        });
      }

      const response = await projectAIService.processMessage(message, { projectId, ...options });
      
      if (response.success) {
        res.json({
          success: true,
          response: response.response,
          tools: response.tools,
          timestamp: response.timestamp,
        });
      } else {
        res.status(500).json({
          success: false,
          error: response.error,
          timestamp: response.timestamp,
        });
      }
    } catch (error) {
      let statusCode = 500;
      let errorMessage = 'Внутренняя ошибка сервера';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Проверяем на ошибку квоты
        if (error.message.includes('Quota exceeded') || error.message.includes('429')) {
          statusCode = 429;
          errorMessage = 'Достигнут дневной лимит запросов к Gemini API. Попробуйте завтра или используйте другую модель.';
        }
      }
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @openapi
   * /api/projects/{projectId}/chat/stream:
   *   post:
   *     summary: Стриминг чата с AI в контексте проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Стриминг ответов AI
   */
  router.post('/:projectId/chat/stream', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const { message, options } = req.body;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Поле message обязательно и должно быть строкой',
          timestamp: new Date().toISOString(),
        });
      }

      // Настраиваем заголовки для Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // Отключаем буферизацию в nginx
      });
      
      // Отправляем первый keepalive для открытия соединения
      res.write(`data: ${JSON.stringify({ type: 'connection_opened', timestamp: new Date().toISOString() })}\n\n`);
      res.flush?.();

      // Получаем сервис для работы с чатами проекта
      const projectChatService = new ProjectChatService(projectAIService.projectService);

      // Сохраняем пользовательское сообщение в историю
      // 1. Найти или создать сессию для этого projectId и пользователя (если есть userId в options)
      let sessionId = options?.sessionId;
      const userId = options?.userId || 'anonymous';
      const sessions = await projectChatService.loadSessions(projectId);
      let session: Session | undefined = sessionId ? sessions.find(s => s.id === sessionId) : undefined;
      if (!session) {
        // Создаём новую сессию
        sessionId = uuidv4();
        const createdSession = await projectChatService.createProjectSession(projectId, userId, sessionId);
        if (createdSession) {
          session = createdSession;
          sessions.push(session);
          await projectChatService.saveSessions(projectId, sessions);
          await projectChatService.saveHistory(projectId, sessionId, []);
        } else {
          res.write(`data: ${JSON.stringify({ type: 'error', timestamp: new Date().toISOString(), error: 'Не удалось создать сессию для проекта' })}\n\n`);
          res.end();
          return;
        }
      }
      // 2. Сохраняем user message
      const userMessage: ChatMessage = {
        type: 'chat_message',
        content: message,
        sender: 'user',
        conversationId: sessionId,
        timestamp: new Date().toISOString(),
        id: uuidv4()
      };
      const history = await projectChatService.loadHistory(projectId, sessionId);
      history.push(userMessage);
      await projectChatService.saveHistory(projectId, sessionId, history);
      // 3. Стримим AI-ответ, буферизуем content, сохраняем tool-ивенты и финальный ответ
      let aiContentBuffer = '';
      let lastTimestamp = new Date().toISOString();
      try {
        for await (const event of projectAIService.processMessageStream(message, { projectId, ...options, sessionId })) {
          if (event.type === 'content' && event.content) {
            aiContentBuffer += event.content;
            lastTimestamp = event.timestamp;
          }
          if (event.type === 'tool_start' || event.type === 'tools_start' || event.type === 'tools_complete') {
            // Сохраняем tool-ивенты как отдельные сообщения типа tool_event
            const toolEvent: ChatMessage = {
              type: 'tool_event',
              content: JSON.stringify(event),
              sender: 'ai',
              conversationId: sessionId,
              timestamp: event.timestamp,
              id: uuidv4()
            };
            history.push(toolEvent);
            await projectChatService.saveHistory(projectId, sessionId, history);
          }
          if (event.type === 'complete') {
            // Сохраняем финальный AI-ответ (final_response) как одно сообщение
            const aiMessage: ChatMessage = {
              type: 'chat_message',
              content: event.final_response || aiContentBuffer,
              sender: 'ai',
              conversationId: sessionId,
              timestamp: event.timestamp || lastTimestamp,
              id: uuidv4()
            };
            history.push(aiMessage);
            await projectChatService.saveHistory(projectId, sessionId, history);
            session!.lastActivity = new Date(event.timestamp || lastTimestamp);
            await projectChatService.saveSessions(projectId, sessions);
            aiContentBuffer = '';
          }
          res.write(`data: ${JSON.stringify(event)}\n\n`);
          res.flush?.(); // Принудительно отправляем данные клиенту
        }
      } catch (streamError) {
        logger.error('Error in Project AI stream:', streamError instanceof Error ? streamError.message : String(streamError));
        res.write(`data: ${JSON.stringify({
          type: 'error',
          timestamp: new Date().toISOString(),
          error: streamError instanceof Error ? streamError.message : 'Unknown error'
        })}\n\n`);
      }
      
      res.end();
    } catch (error) {
      let errorMessage = 'Внутренняя ошибка сервера';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      res.write(`data: ${JSON.stringify({
        type: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage
      })}\n\n`);
      res.end();
    }
  });

  /**
   * @openapi
   * /api/projects/{projectId}/health:
   *   get:
   *     summary: Проверка здоровья AI сервиса для проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     responses:
   *       200:
   *         description: Статус AI сервиса
   */
  router.get('/:projectId/health', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      const health = await projectAIService.getHealth(projectId);
      res.json({
        success: true,
        ...health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @openapi
   * /api/projects/{projectId}/config:
   *   get:
   *     summary: Получение конфигурации AI сервиса для проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     responses:
   *       200:
   *         description: Конфигурация AI сервиса
   */
  router.get('/:projectId/config', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      const config = await projectAIService.getConfig(projectId);
      res.json({
        success: true,
        config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * @openapi
   * /api/projects/{projectId}/cache/clear:
   *   post:
   *     summary: Очистка кэша AI сервиса для проекта
   *     tags:
   *       - ProjectAI
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     responses:
   *       200:
   *         description: Кэш очищен
   */
  router.post('/:projectId/cache/clear', async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId обязателен',
          timestamp: new Date().toISOString(),
        });
      }

      projectAIService.clearCache();
      res.json({
        success: true,
        message: `Кэш AI сервиса для проекта ${projectId} успешно очищен`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
} 