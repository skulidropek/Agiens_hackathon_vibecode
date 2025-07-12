# AI Интеграция с Gemini CLI Core

## Обзор

Наш проект теперь интегрирован с Google Gemini CLI Core, что позволяет использовать мощные AI возможности для работы с кодом прямо в контексте проектов.

## Возможности

### 🔧 Инструменты AI
- **Анализ кода**: AI может анализировать структуру проекта и код
- **Генерация кода**: Создание новых файлов и функций
- **Рефакторинг**: Улучшение существующего кода
- **Отладка**: Поиск и исправление ошибок
- **Документация**: Автоматическое создание документации
- **Тестирование**: Генерация тестов

### 🌐 API Endpoints

#### Общий AI API (`/api/ai`)
- `POST /api/ai/init` - Инициализация AI сервиса
- `POST /api/ai/chat` - Обычный чат с AI
- `POST /api/ai/chat/stream` - Стриминг чата с AI
- `GET /api/ai/health` - Проверка здоровья AI сервиса
- `GET /api/ai/config` - Получение конфигурации AI

#### Проектный AI API (`/api/projects/:projectId`)
- `POST /api/projects/:projectId/init` - Инициализация AI для проекта
- `POST /api/projects/:projectId/chat` - Чат с AI в контексте проекта
- `POST /api/projects/:projectId/chat/stream` - Стриминг чата с AI в контексте проекта
- `GET /api/projects/:projectId/health` - Проверка здоровья AI для проекта
- `GET /api/projects/:projectId/config` - Конфигурация AI для проекта

## Использование

### 1. Инициализация AI сервиса

#### Для общего использования:
```bash
curl -X POST http://localhost:3000/api/ai/init \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "my-session-123",
    "fullContext": true,
    "debugMode": false
  }'
```

#### Для работы с проектом:
```bash
curl -X POST http://localhost:3000/api/projects/project-123/init \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "project-session-456",
    "fullContext": true,
    "debugMode": false
  }'
```

### 2. Отправка сообщений AI

#### Обычный чат:
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай простой React компонент для отображения списка задач",
    "options": {
      "fullContext": true
    }
  }'
```

#### Чат в контексте проекта:
```bash
curl -X POST http://localhost:3000/api/projects/project-123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Проанализируй структуру проекта и предложи улучшения",
    "options": {
      "fullContext": true
    }
  }'
```

### 3. Стриминг ответов

#### Общий стриминг:
```bash
curl -X POST http://localhost:3000/api/ai/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай полноценное веб-приложение с React и Node.js",
    "options": {
      "fullContext": true
    }
  }'
```

#### Проектный стриминг:
```bash
curl -X POST http://localhost:3000/api/projects/project-123/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай API для управления пользователями",
    "options": {
      "fullContext": true
    }
  }'
```

## Типы событий стриминга

При использовании стриминга AI отправляет события следующих типов:

- `start` - Начало обработки запроса
- `content` - Часть текстового ответа
- `tools_start` - Начало выполнения инструментов
- `tool_start` - Начало выполнения конкретного инструмента
- `tool_success` - Успешное выполнение инструмента
- `tool_error` - Ошибка выполнения инструмента
- `tools_complete` - Завершение выполнения всех инструментов
- `complete` - Завершение обработки запроса
- `error` - Ошибка в процессе обработки

## Конфигурация

### Опции AI сервиса

- `sessionId` (обязательно) - Уникальный идентификатор сессии
- `projectPath` - Путь к проекту для работы
- `fullContext` - Загружать полный контекст проекта (boolean)
- `model` - Модель Gemini для использования
- `debugMode` - Включить режим отладки
- `embeddingModel` - Модель для эмбеддингов
- `approvalMode` - Режим подтверждения действий
- `userMemory` - Пользовательская память

### Переменные окружения

Убедитесь, что настроены следующие переменные окружения:

```bash
# Google API ключ для Gemini
GOOGLE_API_KEY=your_api_key_here

# Настройки проекта
PORT=3000
WORKSPACE_DIR=./workspace
```

## Примеры использования

### Создание нового компонента React

```bash
curl -X POST http://localhost:3000/api/projects/my-react-app/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай компонент Button с поддержкой различных размеров и цветов",
    "options": {
      "fullContext": true
    }
  }'
```

### Анализ и рефакторинг кода

```bash
curl -X POST http://localhost:3000/api/projects/my-project/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Проанализируй файл src/utils/helpers.js и предложи улучшения для производительности",
    "options": {
      "fullContext": true
    }
  }'
```

### Создание тестов

```bash
curl -X POST http://localhost:3000/api/projects/my-project/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай unit тесты для функции calculateTotal в файле src/services/calculator.js",
    "options": {
      "fullContext": true
    }
  }'
```

### Генерация документации

```bash
curl -X POST http://localhost:3000/api/projects/my-project/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Создай README.md файл с описанием проекта и инструкциями по установке",
    "options": {
      "fullContext": true
    }
  }'
```

## Безопасность

- AI работает только в контексте указанного проекта
- Все операции логируются для аудита
- Поддерживается аутентификация через Google API
- Ограничения на количество запросов и размер контекста

## Ограничения

- Требуется действительный Google API ключ
- Есть дневные лимиты на использование Gemini API
- Размер контекста ограничен возможностями модели
- Некоторые инструменты могут требовать дополнительных зависимостей

## Устранение неполадок

### Ошибка "Quota exceeded"
Достигнут дневной лимит запросов. Попробуйте завтра или используйте другую модель.

### Ошибка "Project not found"
Убедитесь, что проект существует и ID указан правильно.

### Ошибка "AI Service not initialized"
Сначала инициализируйте AI сервис через endpoint `/init`.

### Ошибка аутентификации
Проверьте правильность Google API ключа и его права доступа.

## Разработка

### Добавление новых инструментов

AI сервис автоматически обнаруживает доступные инструменты из Gemini CLI Core. Для добавления новых инструментов:

1. Установите дополнительные пакеты
2. Перезапустите сервер
3. Инструменты будут доступны автоматически

### Кастомизация конфигурации

Можно настроить различные параметры AI сервиса через конфигурационные файлы или переменные окружения.

## Поддержка

При возникновении проблем:

1. Проверьте логи сервера
2. Убедитесь в правильности конфигурации
3. Проверьте статус Google Gemini API
4. Обратитесь к документации Gemini CLI Core 