# Используем Node.js 18 Alpine образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Создаем директорию workspace
RUN mkdir -p /app/workspace && chown -R nodejs:nodejs /app/workspace

# Собираем приложение
RUN npm run build

# Устанавливаем владельца файлов
RUN chown -R nodejs:nodejs /app

# Переключаемся на пользователя
USER nodejs

# Открываем порт
EXPOSE 3000

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV WORKSPACE_DIR=/app/workspace

# Команда запуска
CMD ["npm", "start"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1 