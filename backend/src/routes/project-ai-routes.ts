import { Router, Request, Response } from 'express';
import { ProjectAIService, ProjectAIOptions } from '../services/project-ai-service';
import { logger } from '../utils/logger';

export function setupProjectAIRoutes(projectAIService: ProjectAIService) {
  const router = Router();

  // Инициализация AI сервиса для проекта
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

  // Чат с AI в контексте проекта
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

  // Стриминг чата с AI в контексте проекта
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
      });

      try {
        for await (const event of projectAIService.processMessageStream(message, { projectId, ...options })) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
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

  // Проверка здоровья AI сервиса для проекта
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

  // Получение конфигурации AI сервиса для проекта
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

  // Очистка кэша AI сервиса для проекта
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