# AI Coding Platform Backend

Бэкенд для AI платформы кодинга с интеграцией Gemini API, поддержкой WebSocket для реального времени и REST API для управления файлами.

## Функциональность

- **WebSocket чат** - общение с AI в реальном времени
- **Терминальная интеграция** - выполнение команд через node-pty
- **Файловый менеджер** - управление файлами через REST API
- **Типобезопасность** - полная типизация TypeScript с блокировкой `any`
- **Безопасность** - валидация входных данных и ограничение доступа к файлам
- **Логирование** - структурированные логи с цветовой подсветкой

## Архитектура

```
Frontend (3 панели)
├── Чат с AI (WebSocket)
├── Терминал (WebSocket) 
└── Файловый браузер (REST API)

Backend (Express.js + WebSocket)
├── WebSocket Server (/ws)
├── REST API (/api/files, /api/chat)
├── Gemini CLI интеграция
└── Файловая система (workspace/)
```

## Установка

### Требования

- Node.js 18+
- npm или yarn
- Gemini API ключ

### Установка зависимостей

```bash
npm install
```

### Настройка окружения

1. Скопируйте файл примера переменных окружения:
```bash
cp env.example .env
```

2. Отредактируйте `.env` файл:
```env
PORT=3000
HOST=localhost
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
WORKSPACE_DIR=./workspace
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_jwt_secret_here_change_in_production
MAX_FILE_SIZE=10485760
```

## Запуск

### Разработка

```bash
# Запуск в режиме разработки с hot reload
npm run dev
```

### Продакшен

```bash
# Сборка проекта
npm run build

# Запуск собранного проекта
npm start
```

## API Документация

### WebSocket API

#### Подключение

```javascript
// Чат WebSocket
const chatWS = new WebSocket('ws://localhost:3000/ws?type=chat&sessionId=session123');

// Терминал WebSocket  
const terminalWS = new WebSocket('ws://localhost:3000/ws?type=terminal&sessionId=session123');
```

#### Сообщения чата

```javascript
// Отправка сообщения
chatWS.send(JSON.stringify({
  type: 'chat_message',
  content: 'Создай React приложение',
  sender: 'user',
  conversationId: 'conversation123'
}));

// Получение ответа
chatWS.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'chat_response') {
    console.log('AI ответ:', message.content);
  }
};
```

#### Терминальные команды

```javascript
// Выполнение команды
terminalWS.send(JSON.stringify({
  type: 'terminal_command',
  command: 'ls -la',
  sessionId: 'session123'
}));

// Получение вывода
terminalWS.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'terminal_output') {
    console.log('Вывод:', message.data);
  }
};
```

### REST API

#### Файловые операции

```javascript
// Получить список файлов
GET /api/files
GET /api/files?recursive=true&filter=.js

// Получить содержимое файла
GET /api/files/src/index.js

// Создать/обновить файл
POST /api/files/src/new-file.js
{
  "content": "console.log('Hello World');",
  "encoding": "utf-8"
}

// Удалить файл
DELETE /api/files/src/old-file.js
```

#### Управление сессиями

```javascript
// Создать сессию
POST /api/chat/sessions
{
  "userId": "user123"
}

// Получить историю чата
GET /api/chat/sessions/session123/history?limit=50&offset=0

// Завершить сессию
DELETE /api/chat/sessions/session123
```

## Разработка

### Структура проекта

```
src/
├── config/          # Конфигурация приложения
├── middleware/      # Express middleware
├── routes/          # REST API маршруты
├── websocket/       # WebSocket обработчики
├── types/           # TypeScript типы
├── utils/           # Утилиты
└── index.ts         # Входная точка
```

### Скрипты

```bash
# Разработка
npm run dev          # Запуск с hot reload
npm run build        # Сборка проекта
npm start           # Запуск продакшен версии

# Тестирование
npm test            # Запуск тестов
npm run test:watch  # Тесты в watch режиме

# Линтинг
npm run lint        # Проверка кода
npm run lint:fix    # Исправление ошибок
```

### ESLint конфигурация

Проект использует строгие правила ESLint с блокировкой `any`:

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unsafe-*: error`
- Строгие правила TypeScript
- Ограничения на сложность кода

### Типизация

Все типы строго типизированы без использования `any` или `unknown`:

```typescript
// ✅ Правильно - конкретные типы
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ❌ Неправильно - избегаем any
interface BadResponse {
  data: any; // Заблокировано ESLint
}
```

## Безопасность

### Файловая система

- Ограничение доступа к workspace директории
- Валидация расширений файлов
- Защита от path traversal атак

### WebSocket

- Валидация всех входящих сообщений
- Ограничение размера сообщений
- Автоматическое закрытие неактивных соединений

### API

- CORS защита
- Валидация входных данных
- Ограничение размера запросов

## Мониторинг

### Логирование

```typescript
import { logger } from './utils/logger';

logger.info('Server started', { port: 3000 });
logger.error('Database error', { error: error.message });
logger.debug('Processing request', { userId: 'user123' });
```

### Метрики

- Количество активных WebSocket соединений
- Статистика терминальных сессий
- Производительность файловых операций

## Развертывание

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Переменные окружения продакшена

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
GEMINI_API_KEY=your_production_key
JWT_SECRET=your_strong_production_secret
WORKSPACE_DIR=/app/workspace
```

## Интеграция с фронтендом

### React пример

```javascript
import { useEffect, useState } from 'react';

function ChatComponent() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:3000/ws?type=chat&sessionId=session123');
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'chat_response') {
        setMessages(prev => [...prev, message]);
      }
    };

    setWs(websocket);
    
    return () => websocket.close();
  }, []);

  const sendMessage = (content) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'chat_message',
        content,
        sender: 'user',
        conversationId: 'conversation123'
      }));
    }
  };

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
      <input onKeyPress={(e) => {
        if (e.key === 'Enter') {
          sendMessage(e.target.value);
          e.target.value = '';
        }
      }} />
    </div>
  );
}
```

## Лицензия

MIT 