# API Управления Проектами

## Обзор

Система управления проектами позволяет создавать, управлять и переключаться между множественными проектами. Каждый проект может быть:
- **Локальным** - пустая папка для нового проекта
- **Git репозиторием** - клонированный репозиторий

## Архитектура

```
├── projects/                    # Папка всех проектов
│   ├── .projects.json          # Метаданные проектов
│   ├── project-1/              # Локальный проект
│   ├── react-app/              # Клонированный Git проект
│   └── ...
```

## API Endpoints

### GET /api/projects
Получить список всех проектов

**Ответ:**
```json
{
  "projects": [
    {
      "id": "uuid-123",
      "name": "My Project",
      "path": "/path/to/project",
      "type": "local",
      "description": "Описание проекта",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "lastAccessed": "2023-01-01T00:00:00.000Z",
      "isActive": true
    }
  ],
  "activeProject": {
    "id": "uuid-123",
    "name": "My Project",
    "..."
  }
}
```

### GET /api/projects/stats
Получить статистику проектов

**Ответ:**
```json
{
  "totalProjects": 5,
  "gitProjects": 3,
  "localProjects": 2,
  "activeProject": "uuid-123"
}
```

### GET /api/projects/active
Получить активный проект

**Ответ:**
```json
{
  "id": "uuid-123",
  "name": "Active Project",
  "path": "/path/to/active",
  "type": "local",
  "isActive": true,
  "..."
}
```

### GET /api/projects/:id
Получить проект по ID

**Параметры:**
- `id` - UUID проекта

**Ответ:**
```json
{
  "id": "uuid-123",
  "name": "Project Name",
  "path": "/path/to/project",
  "type": "git",
  "gitUrl": "https://github.com/user/repo.git",
  "branch": "main",
  "..."
}
```

### POST /api/projects
Создать новый проект

**Тело запроса:**
```json
{
  "name": "New Project",
  "type": "local",
  "description": "Описание проекта"
}
```

**Или для Git проекта:**
```json
{
  "name": "React App",
  "type": "git",
  "gitUrl": "https://github.com/facebook/react.git",
  "branch": "main",
  "description": "React репозиторий"
}
```

**Ответ:**
```json
{
  "id": "uuid-456",
  "name": "New Project",
  "path": "/path/to/new/project",
  "type": "local",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "..."
}
```

### PUT /api/projects/:id/activate
Активировать проект

**Параметры:**
- `id` - UUID проекта

**Ответ:**
```json
{
  "id": "uuid-123",
  "name": "Activated Project",
  "isActive": true,
  "lastAccessed": "2023-01-01T00:00:00.000Z",
  "..."
}
```

### DELETE /api/projects/:id
Удалить проект

**Параметры:**
- `id` - UUID проекта

**Ответ:**
```json
{
  "message": "Проект успешно удален"
}
```

## Примеры использования

### Создание локального проекта

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-new-project",
    "type": "local",
    "description": "Новый локальный проект"
  }'
```

### Клонирование Git репозитория

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "react-app",
    "type": "git",
    "gitUrl": "https://github.com/facebook/react.git",
    "branch": "main"
  }'
```

### Получение списка проектов

```bash
curl http://localhost:3000/api/projects
```

### Активация проекта

```bash
curl -X PUT http://localhost:3000/api/projects/uuid-123/activate
```

### Удаление проекта

```bash
curl -X DELETE http://localhost:3000/api/projects/uuid-123
```

## Типы данных

### Project
```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  type: 'git' | 'local';
  gitUrl?: string;
  branch?: string;
  description?: string;
  createdAt: Date;
  lastAccessed: Date;
  isActive?: boolean;
}
```

### CreateProjectRequest
```typescript
interface CreateProjectRequest {
  name: string;
  type: 'git' | 'local';
  gitUrl?: string;
  branch?: string;
  description?: string;
}
```

## Валидация

- **name** - обязательно, не пустое
- **type** - обязательно, 'git' или 'local'
- **gitUrl** - обязательно для Git проектов
- **branch** - по умолчанию 'main'

## Ошибки

### 400 Bad Request
```json
{
  "error": "Имя и тип проекта обязательны"
}
```

### 404 Not Found
```json
{
  "error": "Проект не найден"
}
```

### 500 Internal Server Error
```json
{
  "error": "Ошибка создания проекта: Git clone failed"
}
```

## Функциональность

- ✅ Создание локальных проектов
- ✅ Клонирование Git репозиториев
- ✅ Активация/деактивация проектов
- ✅ Удаление проектов
- ✅ Статистика проектов
- ✅ Валидация данных
- ✅ Обработка ошибок
- ✅ Тесты (unit и integration)

## Структура файлов

```
src/
├── types/project.ts           # Типы данных
├── services/project-service.ts # Бизнес-логика
├── routes/project-routes.ts   # API роуты
└── __tests__/
    ├── project-service.test.ts
    └── project-routes.test.ts
```

---

*Документация создана автоматически AGI Assistant* 