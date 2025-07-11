# Интеграция чатов с проектами

## Обзор

Система чатов теперь полностью интегрирована с системой управления проектами. **Все чаты работают только в рамках активного проекта**.

## Ключевые изменения

### 🔄 Новая архитектура

```
Frontend → Select Project → Activate Project → Chat Session (Project-bound)
                                                      ↓
                                            AI Context (Project files only)
```

### 📁 Project-aware файловые операции

**Новые endpoints:**
- `GET /api/files/project` - файлы активного проекта
- `GET /api/files/project/:path` - содержимое файла из проекта
- `POST /api/files/project/:path` - создание/обновление файла в проекте
- `DELETE /api/files/project/:path` - удаление файла из проекта
- `GET /api/files/project-stats` - статистика проекта

### 💬 Project-bound чаты

**Обновленные endpoints:**
- `POST /api/chat/sessions` - создание сессии требует активного проекта
- Все сессии теперь содержат `projectId`
- AI контекст включает только файлы активного проекта

## Новые компоненты

### ProjectChatService

Основной сервис для интеграции чатов с проектами:

```typescript
class ProjectChatService {
  // Получить AI контекст для активного проекта
  async getAIContext(): Promise<AIContext>
  
  // Безопасный путь в рамках проекта
  getSecureProjectPath(relativePath: string): string | null
  
  // Проверка принадлежности пути к проекту
  isPathInActiveProject(absolutePath: string): boolean
  
  // Создание сессии для проекта
  createProjectSession(userId: string, conversationId: string): Session | null
  
  // Статистика проекта
  async getProjectStats(): Promise<ProjectStats>
}
```

### Обновленные типы

```typescript
interface ChatMessage {
  // ... existing fields
  projectId?: string; // Привязка к проекту
}

interface Session {
  // ... existing fields  
  projectId?: string; // Привязка к проекту
}

interface AIContext {
  projectId?: string;     // ID активного проекта
  projectName?: string;   // Имя проекта
  projectPath?: string;   // Путь к проекту
  // ... existing fields
}
```

## Безопасность

### Path Security
- Все пути нормализуются и проверяются
- Блокируются попытки выйти за пределы проекта (`../../../etc/passwd`)
- Файловые операции ограничены активным проектом

### Project Isolation
- Каждый чат работает только с файлами своего проекта
- AI контекст не включает файлы других проектов
- Полная изоляция между проектами

## Использование

### 1. Активация проекта

```bash
# Активируем проект
curl -X PUT http://localhost:3000/api/projects/PROJECT_ID/activate
```

### 2. Создание чат-сессии

```bash
# Создаем сессию (автоматически привязывается к активному проекту)
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'

# Ответ содержит projectId
{
  "success": true,
  "data": {
    "id": "session-id",
    "projectId": "project-id",
    "userId": "user123",
    "conversationId": "conv-id",
    "isActive": true
  }
}
```

### 3. Работа с файлами проекта

```bash
# Получить файлы активного проекта
curl http://localhost:3000/api/files/project

# Получить содержимое файла
curl http://localhost:3000/api/files/project/src/index.js

# Создать файл в проекте
curl -X POST http://localhost:3000/api/files/project/new-file.js \
  -H "Content-Type: application/json" \
  -d '{"content": "console.log(\"Hello from project!\");"}'

# Статистика проекта
curl http://localhost:3000/api/files/project-stats
```

## Миграция

### Для фронтенда

1. **Обязательная активация проекта** перед созданием чат-сессии
2. **Использование новых endpoints** для файловых операций
3. **Обработка ошибок** при отсутствии активного проекта

### Для AI интеграции

1. **AI контекст** теперь включает метаданные проекта
2. **Файлы ограничены** активным проектом
3. **Безопасность** - нет доступа к файлам вне проекта

## Обратная совместимость

- Старые файловые endpoints (`/api/files/*`) остаются доступными
- Чат-сессии без проекта создаются только если `ProjectChatService` недоступен
- Graceful degradation при отсутствии активного проекта

## Тестирование

### Unit тесты
- `ProjectChatService` - полное покрытие
- Безопасность путей
- Создание сессий
- AI контекст

### Integration тесты
- Project-aware файловые операции
- Создание чат-сессий с проектами
- Статистика проектов

## Примеры

### Полный workflow

```bash
# 1. Создать проект
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "type": "local"}'

# 2. Активировать проект
curl -X PUT http://localhost:3000/api/projects/PROJECT_ID/activate

# 3. Создать чат-сессию
curl -X POST http://localhost:3000/api/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "developer"}'

# 4. Получить файлы проекта
curl http://localhost:3000/api/files/project

# 5. Создать файл в проекте
curl -X POST http://localhost:3000/api/files/project/app.js \
  -H "Content-Type: application/json" \
  -d '{"content": "// My app code"}'

# 6. Получить статистику
curl http://localhost:3000/api/files/project-stats
```

## Диагностика

### Проверка активного проекта

```bash
curl http://localhost:3000/api/projects/active
```

### Проверка сессий

```bash
curl http://localhost:3000/api/chat/sessions
```

### Логи

Все операции логируются с указанием `projectId`:

```
[INFO] New chat session created { sessionId, conversationId, userId, projectId }
[INFO] Fetching project files list { projectName: "my-app" }
[INFO] Creating/updating project file { path: "/project/path/file.js" }
```

---

## ✅ Результат

**Чаты теперь работают ТОЛЬКО с проектами:**
- ✅ Каждый чат привязан к активному проекту
- ✅ AI видит только файлы текущего проекта
- ✅ Полная изоляция между проектами
- ✅ Безопасность файловых операций
- ✅ Обратная совместимость
- ✅ Полное покрытие тестами

*Создано AGI Assistant - вашим автономным помощником по разработке* 