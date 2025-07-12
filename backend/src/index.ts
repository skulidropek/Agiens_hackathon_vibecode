import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

import { setupWebSocketRoutes } from './websocket/websocket-handler';
import { setupFileRoutes } from './routes/file-routes';
import { setupChatRoutes } from './routes/chat-routes';
import { setupProjectRoutes } from './routes/project-routes';
import { setupProjectFileRoutes } from './routes/project-file-routes';
import { setupAIRoutes } from './routes/ai-routes';
import { setupProjectAIRoutes } from './routes/project-ai-routes';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import { AppConfig } from './config/app-config';
import { ProjectService } from './services/project-service';
import { ProjectChatService } from './services/project-chat-service';
import { AIService } from './services/ai-service';
import { ProjectAIService } from './services/project-ai-service';

// Загружаем переменные окружения
dotenv.config();

const config = new AppConfig();
const app = express();
const server = createServer(app);

// Swagger/OpenAPI конфиг (после config)
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Coding Platform API',
      version: '1.0.0',
      description: 'Документация REST API для фронтенда',
    },
    servers: [
      { url: `http://${config.host}:${config.port}`, description: 'Local server' }
    ],
  },
  apis: ['./src/routes/*.ts'], // JSDoc-аннотации в роутерах
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Инициализация сервисов
const projectService = new ProjectService(config.workspaceDir);
const projectChatService = new ProjectChatService(projectService);
const aiService = new AIService();
const projectAIService = new ProjectAIService(projectService);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Эндпоинт для получения raw OpenAPI спецификации (JSON)
app.get('/api-docs/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Swagger UI должен быть ДО всех API-роутов
// @ts-ignore
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Маршруты API
app.use('/api/files', setupProjectFileRoutes(projectChatService)); // Project-aware файлы (приоритет)
app.use('/api/files', setupFileRoutes()); // Fallback для общих файлов
app.use('/api/chat', setupChatRoutes(projectChatService)); // Project-aware чаты
app.use('/api/projects', setupProjectRoutes(projectService));
app.use('/api/ai', setupAIRoutes(aiService)); // AI интеграция с Gemini
app.use('/api/projects', setupProjectAIRoutes(projectAIService)); // Project AI интеграция

// Проверка здоровья сервера
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Обработка ошибок
app.use(errorHandler);

// Настройка WebSocket сервера
const wss = new WebSocketServer({ 
  server,
  path: '/ws' 
});

setupWebSocketRoutes(wss);

// Запуск сервера
server.listen(config.port, config.host, () => {
  logger.info(`🚀 AI Coding Platform Backend запущен на http://${config.host}:${config.port}`);
  logger.info(`📡 WebSocket сервер доступен на ws://${config.host}:${config.port}/ws`);
  logger.info(`🔧 Рабочая директория: ${config.workspaceDir}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM. Завершаю работу...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Получен сигнал SIGINT. Завершаю работу...');
  server.close(() => {
    logger.info('Сервер остановлен');
    process.exit(0);
  });
});

export { app, server, wss }; 