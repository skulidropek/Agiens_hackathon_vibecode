import { Router, Request, Response } from 'express';
import { AIService, AIServiceOptions } from '../services/ai-service';
import { logger } from '../utils/logger';

export function setupAIRoutes(aiService: AIService) {
  const router = Router();

  // Инициализация AI сервиса
  router.post('/init', async (req: Request, res: Response) => {
    try {
      const options: AIServiceOptions = req.body;
      
      if (!options.sessionId) {
        return res.status(400).json({
          success: false,
          error: 'sessionId обязателен для инициализации AI сервиса',
          timestamp: new Date().toISOString(),
        });
      }

      await aiService.initialize(options);
      
      res.json({
        success: true,
        message: 'AI сервис успешно инициализирован',
        sessionId: options.sessionId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error initializing AI service:', error instanceof Error ? error.message : String(error));
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Обычный чат с AI
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { message, options } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Поле message обязательно и должно быть строкой',
          timestamp: new Date().toISOString(),
        });
      }

      const response = await aiService.processMessage(message, options);
      
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

  // Стриминг чата с AI
  router.post('/chat/stream', async (req: Request, res: Response) => {
    try {
      const { message, options } = req.body;
      
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
        for await (const event of aiService.processMessageStream(message, options)) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (streamError) {
        logger.error('Error in AI stream:', streamError instanceof Error ? streamError.message : String(streamError));
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

  // Проверка здоровья AI сервиса
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await aiService.getHealth();
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

  // Получение конфигурации AI сервиса
  router.get('/config', async (req: Request, res: Response) => {
    try {
      const config = await aiService.getConfig();
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

  // Очистка кэша AI сервиса
  router.post('/cache/clear', async (req: Request, res: Response) => {
    try {
      aiService.clearCache();
      res.json({
        success: true,
        message: 'Кэш AI сервиса успешно очищен',
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

  // Получение информации о кэше
  router.get('/cache/info', async (req: Request, res: Response) => {
    try {
      const health = await aiService.getHealth();
      res.json({
        success: true,
        cacheSize: health.cacheSize,
        status: health.status,
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