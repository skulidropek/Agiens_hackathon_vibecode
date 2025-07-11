import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

import { setupWebSocketRoutes } from './websocket/websocket-handler';
import { setupFileRoutes } from './routes/file-routes';
import { setupChatRoutes } from './routes/chat-routes';
import { setupProjectRoutes } from './routes/project-routes';
import { setupProjectFileRoutes } from './routes/project-file-routes';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import { AppConfig } from './config/app-config';
import { ProjectService } from './services/project-service';
import { ProjectChatService } from './services/project-chat-service';

// Загружаем переменные окружения
dotenv.config();

const config = new AppConfig();
const app = express();
const server = createServer(app);

// Инициализация сервисов
const projectService = new ProjectService(config.workspaceDir);
const projectChatService = new ProjectChatService(projectService);

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

// Маршруты API
app.use('/api/files', setupProjectFileRoutes(projectChatService)); // Project-aware файлы (приоритет)
app.use('/api/files', setupFileRoutes()); // Fallback для общих файлов
app.use('/api/chat', setupChatRoutes(projectChatService)); // Project-aware чаты
app.use('/api/projects', setupProjectRoutes(projectService));

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