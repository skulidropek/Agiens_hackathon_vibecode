import { WebSocketConnection, ChatMessage, ChatResponse, ChatError, GeminiRequest, GeminiResponse } from '../types';
import { logger } from '../utils/logger';
import { AppConfig } from '../config/app-config';
import { addMessageToHistory } from '../routes/chat-routes';
import { v4 as uuidv4 } from 'uuid';

const config = new AppConfig();

export class ChatHandler {
  private geminiProcess: NodeJS.Process | null = null;
  private isProcessing = false;

  constructor() {
    this.initializeGeminiProcess();
  }

  private initializeGeminiProcess(): void {
    // В реальном проекте здесь будет инициализация Gemini CLI процесса
    // Пока используем заглушку
    logger.info('Initializing Gemini process');
  }

  public async processMessage(connection: WebSocketConnection, message: ChatMessage): Promise<void> {
    if (this.isProcessing) {
      this.sendErrorMessage(connection, 'Previous message is still being processed', 'PROCESSING_IN_PROGRESS');
      return;
    }

    this.isProcessing = true;

    try {
      logger.info('Processing chat message', {
        connectionId: connection.id,
        sessionId: connection.sessionId,
        messageLength: message.content.length
      });

      // Сразу подтверждаем получение сообщения
      this.sendAcknowledgment(connection, message);

      // Обрабатываем сообщение через Gemini
      const aiResponse = await this.processWithGemini(message);

      // Отправляем ответ
      const responseMessage: ChatResponse = {
        type: 'chat_response',
        content: aiResponse.content,
        sender: 'ai',
        conversationId: message.conversationId,
        timestamp: new Date().toISOString(),
        id: uuidv4()
      };

      this.sendMessage(connection, responseMessage);

      // Сохраняем ответ в истории (приводим к ChatMessage)
      if (message.conversationId) {
        const chatMessage: ChatMessage = {
          type: 'chat_message',
          content: responseMessage.content,
          sender: responseMessage.sender,
          conversationId: responseMessage.conversationId,
          timestamp: responseMessage.timestamp,
          id: responseMessage.id
        };
        addMessageToHistory(message.conversationId, chatMessage);
      }

      logger.info('Chat message processed successfully', {
        connectionId: connection.id,
        responseLength: aiResponse.content.length,
        tokensUsed: aiResponse.usage?.totalTokens || 0
      });

    } catch (error) {
      logger.error('Error processing chat message', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.sendErrorMessage(
        connection,
        'Failed to process your message. Please try again.',
        'PROCESSING_ERROR'
      );
    } finally {
      this.isProcessing = false;
    }
  }

  private async processWithGemini(message: ChatMessage): Promise<GeminiResponse> {
    // Создаем запрос к Gemini
    const request: GeminiRequest = {
      prompt: message.content,
      context: {
        workspaceFiles: [], // Здесь будут файлы из workspace
        currentDirectory: config.workspaceDir,
        terminalHistory: [], // Здесь будет история терминала
        chatHistory: [] // Здесь будет история чата
      },
      tools: ['shell', 'files'], // Инструменты для AI
      temperature: 0.7,
      maxTokens: 2048
    };

    // Здесь будет реальная интеграция с Gemini API
    // Пока используем mock
    return this.mockGeminiResponse(request);
  }

  private async mockGeminiResponse(request: GeminiRequest): Promise<GeminiResponse> {
    // Имитируем задержку обработки
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Простая логика для демонстрации
    let response = '';
    
    if (request.prompt.toLowerCase().includes('создай') || request.prompt.toLowerCase().includes('создать')) {
      response = `Я создам для вас ${request.prompt}. Сейчас выполню необходимые команды в терминале.`;
    } else if (request.prompt.toLowerCase().includes('помощь') || request.prompt.toLowerCase().includes('help')) {
      response = `Я могу помочь вам с:
- Создание файлов и проектов
- Выполнение команд в терминале
- Редактирование кода
- Объяснение кода и технологий
- Отладка и исправление ошибок

Просто напишите, что вам нужно сделать!`;
    } else if (request.prompt.toLowerCase().includes('файл') || request.prompt.toLowerCase().includes('file')) {
      response = `Работаю с файлами в директории ${request.context?.currentDirectory}. Какие операции с файлами вам нужны?`;
    } else {
      response = `Понял ваш запрос: "${request.prompt}". Обрабатываю...`;
    }

    return {
      content: response,
      usage: {
        promptTokens: request.prompt.length / 4, // Примерная оценка
        completionTokens: response.length / 4,
        totalTokens: (request.prompt.length + response.length) / 4
      },
      finishReason: 'stop'
    };
  }

  private sendMessage(connection: WebSocketConnection, message: ChatResponse): void {
    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
    }
  }

  private sendErrorMessage(connection: WebSocketConnection, message: string, code: string): void {
    const errorMessage: ChatError = {
      type: 'chat_error',
      error: message,
      code,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(errorMessage));
    }
  }

  private sendAcknowledgment(connection: WebSocketConnection, originalMessage: ChatMessage): void {
    const ackMessage = {
      type: 'message_received',
      originalMessageId: originalMessage.id,
      timestamp: new Date().toISOString()
    };

    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(ackMessage));
    }
  }

  // Очистка ресурсов
  public cleanup(): void {
    if (this.geminiProcess) {
      try {
        this.geminiProcess.kill(15); // SIGTERM
      } catch (error) {
        logger.warn('Error killing Gemini process', error instanceof Error ? error.message : String(error));
      }
      this.geminiProcess = null;
    }
  }
} 