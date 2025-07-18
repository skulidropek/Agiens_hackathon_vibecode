import type { FunctionCall, GenerateContentResponse, Content, Part } from '@google/genai';
import { ToolCallRequestInfo, executeToolCall } from '@google/gemini-cli-core';
import { Config, ApprovalMode, DEFAULT_GEMINI_FLASH_MODEL, DEFAULT_GEMINI_EMBEDDING_MODEL, AuthType } from '@google/gemini-cli-core';
import { logger } from '../utils/logger';
import { PathManager } from '../utils/path-manager';
import { RetryUtils } from '../utils/retry-utils';
import { GeminiChat } from '@google/gemini-cli-core/dist/src/core/geminiChat';
import { ToolRegistry } from '@google/gemini-cli-core/dist/src/tools/tool-registry';
import { AIContext } from '../types';
import { AITerminalIntegration } from './ai-terminal-integration';
import { TerminalService } from './terminal-service';
import { ProjectService } from './project-service';
import { AppConfig } from '../config/app-config';
import { CustomConfig } from './custom-config';

export interface AIServiceOptions {
  sessionId: string;
  model?: string;
  embeddingModel?: string;
  cwd?: string;
  debugMode?: boolean;
  question?: string;
  approvalMode?: ApprovalMode;
  userMemory?: string;
  fullContext?: boolean;
  projectPath?: string;
  aiContext?: AIContext; // Добавляем поддержку AI контекста
}

export interface AIResponse {
  success: boolean;
  response?: string;
  error?: string;
  timestamp: string;
  tools?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
    error?: string;
  }>;
}

export interface AIStreamEvent {
  type: 'start' | 'content' | 'tools_start' | 'tool_start' | 'tool_success' | 'tool_error' | 'tools_complete' | 'complete' | 'error';
  timestamp: string;
  content?: string;
  error?: string;
  tools?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
    error?: string;
  }>;
  tool?: {
    name: string;
    args?: Record<string, unknown>;
    result?: string;
    error?: string;
  };
  final_response?: string;
}

interface ConfigCacheEntry {
  config: Config;
  lastUsed: number;
  sessionId: string;
}

export class AIService {
  private configCache = new Map<string, ConfigCacheEntry>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 минут
  private readonly MAX_CACHE_SIZE = 10;
  private aiTerminalIntegration: AITerminalIntegration | null = null;
  private terminalService: TerminalService | null = null;

  constructor(terminalService?: TerminalService) {
    this.terminalService = terminalService || null;
  }

  /**
   * Инициализация AI сервиса
   */
  async initialize(options: AIServiceOptions): Promise<void> {
    try {
      const config = await this.createCoreConfig(options);
      const cacheKey = this.getCacheKey(options.sessionId, options.projectPath || process.cwd());
      
      this.configCache.set(cacheKey, {
        config,
        lastUsed: Date.now(),
        sessionId: options.sessionId
      });
      
      // Инициализируем интеграцию с терминалом
      if (!this.aiTerminalIntegration) {
        logger.info('🔧 Инициализируем AITerminalIntegration...');
        const appConfig = new AppConfig();
        const projectService = new ProjectService(appConfig.workspaceDir);
        const terminalService = new TerminalService(appConfig, projectService);
        this.aiTerminalIntegration = new AITerminalIntegration(terminalService);
        logger.info('✅ AITerminalIntegration инициализирован');
      }


      
      logger.info(`AI Service initialized for session: ${options.sessionId}`);
    } catch (error) {
      logger.error('Failed to initialize AI Service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Получить или создать конфигурацию с кэшированием
   */
  private async getOrCreateConfig(sessionId: string, projectPath: string): Promise<Config> {
    const cacheKey = this.getCacheKey(sessionId, projectPath);
    const cached = this.configCache.get(cacheKey);
    
    if (cached && Date.now() - cached.lastUsed < this.CACHE_TTL) {
      logger.info('AIService: Using cached config', { sessionId, projectPath });
      cached.lastUsed = Date.now();
      return cached.config;
    }

    logger.info('AIService: Creating new config', { sessionId, projectPath });

    // Очищаем старые записи кэша
    this.cleanupCache();
    
    // Создаем новую конфигурацию
    const config = await RetryUtils.executeWithRetryAndTimeout(
      () => this.createCoreConfig({ sessionId, projectPath }),
      { maxRetries: 2 },
      15000
    );

    this.configCache.set(cacheKey, {
      config,
      lastUsed: Date.now(),
      sessionId
    });

    logger.info('AIService: Config created', { 
      sessionId, 
      projectPath, 
      configType: config.constructor.name
    });

    return config;
  }

  /**
   * Очистка устаревших записей кэша
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.configCache.entries());
    
    // Удаляем устаревшие записи
    for (const [key, entry] of entries) {
      if (now - entry.lastUsed > this.CACHE_TTL) {
        this.configCache.delete(key);
      }
    }

    // Если кэш слишком большой, удаляем самые старые записи
    if (this.configCache.size > this.MAX_CACHE_SIZE) {
      const sortedEntries = entries
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
        .slice(0, this.configCache.size - this.MAX_CACHE_SIZE);
      
      for (const [key] of sortedEntries) {
        this.configCache.delete(key);
      }
    }
  }

  /**
   * Генерация ключа кэша
   */
  private getCacheKey(sessionId: string, projectPath: string): string {
    return `${sessionId}:${projectPath}`;
  }

  /**
   * Создание конфигурации Gemini
   */
  private async createCoreConfig(options: AIServiceOptions): Promise<Config> {
    const workingDir = PathManager.normalizeProjectPath(options.projectPath || options.cwd || process.cwd());
    
    // Создаем сервисы для кастомной конфигурации
    const appConfig = new AppConfig();
    const projectService = new ProjectService(appConfig.workspaceDir);
    
    // Используем переданный TerminalService или создаем новый
    const terminalService = this.terminalService || new TerminalService(appConfig, projectService);
    
    // Дожидаемся загрузки проектов перед получением списка
    await projectService.loadProjects();
    
    // Используем первый доступный проект или создаем временный
    let projectId = 'default-project';
    const projectsResponse = await projectService.listProjects();
    logger.info('AIService: Available projects', { 
      totalProjects: projectsResponse.projects.length,
      projects: projectsResponse.projects.map(p => ({ id: p.id, name: p.name, path: p.path }))
    });
    
    if (projectsResponse.projects.length > 0) {
      projectId = projectsResponse.projects[0].id;
      logger.info('AIService: Using first available project', { 
        projectId, 
        projectName: projectsResponse.projects[0].name 
      });
    } else {
      logger.warn('AIService: No projects available, using default ID', { projectId });
    }
    
    const config = new CustomConfig({
      sessionId: options.sessionId,
      embeddingModel: options.embeddingModel || DEFAULT_GEMINI_EMBEDDING_MODEL,
      targetDir: workingDir,
      debugMode: options.debugMode || false,
      question: options.question || '',
      approvalMode: options.approvalMode || ApprovalMode.DEFAULT,
      userMemory: options.userMemory || '',
      model: options.model || DEFAULT_GEMINI_FLASH_MODEL,
      cwd: workingDir,
      fullContext: options.fullContext || false,
      coreTools: undefined,
      excludeTools: undefined,
      toolDiscoveryCommand: undefined,
      toolCallCommand: undefined,
      mcpServerCommand: undefined,
      mcpServers: undefined,
      geminiMdFileCount: 0,
      showMemoryUsage: false,
      accessibility: {},
      telemetry: { enabled: false },
      usageStatisticsEnabled: true,
      fileFiltering: {
        respectGitIgnore: true,
        enableRecursiveFileSearch: true,
      },
      checkpointing: false,
      proxy: undefined,
      fileDiscoveryService: undefined,
      bugCommand: undefined,
      extensionContextFilePaths: [],
      listExtensions: false,
      activeExtensions: [],
      noBrowser: false,
    }, terminalService, projectId);

    await config.initialize();
    await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
    
    return config;
  }

  /**
   * Извлечение текста из ответа Gemini
   */
  private getResponseText(response: GenerateContentResponse): string | null {
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (
        candidate.content &&
        candidate.content.parts &&
        candidate.content.parts.length > 0
      ) {
        const thoughtPart = candidate.content.parts[0];
        if (thoughtPart?.thought) {
          return null;
        }
        
        // Собираем весь текст из всех частей
        const textParts = candidate.content.parts
          .filter((part) => part.text)
          .map((part) => part.text);
        
        const fullText = textParts.join('');
        
        // Проверяем, не является ли ответ JSON
        try {
          const parsed = JSON.parse(fullText);
          // Если это JSON, извлекаем только текстовое содержимое
          if (parsed && typeof parsed === 'object') {
            // Ищем текстовое содержимое в JSON структуре
            if (parsed.content) {
              return parsed.content;
            } else if (parsed.text) {
              return parsed.text;
            } else if (parsed.message) {
              return parsed.message;
            } else if (Array.isArray(parsed)) {
              // Если это массив, ищем первый элемент с текстом
              for (const item of parsed) {
                if (item.content) return item.content;
                if (item.text) return item.text;
                if (item.message) return item.message;
              }
            }
            // Если не нашли текстовое содержимое, возвращаем как есть
            return fullText;
          }
        } catch (e) {
          // Если это не JSON, возвращаем как есть
          return fullText;
        }
        
        return fullText;
      }
    }
    return null;
  }

  /**
   * Общая логика обработки сообщений AI
   */
  private async processWithAI(
    input: string, 
    options: Partial<AIServiceOptions> = {},
    isStream: boolean = false
  ): Promise<AIResponse | AsyncGenerator<AIStreamEvent>> {
    try {
      const projectPath = PathManager.normalizeProjectPath(options.projectPath || process.cwd());
      const sessionId = options.sessionId || `api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      
      // Получаем или создаем конфигурацию
      const config = await this.getOrCreateConfig(sessionId, projectPath);
      
      const prompt_id = `api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const geminiClient = config.getGeminiClient();
      const toolRegistry = await config.getToolRegistry();



      const chat = await geminiClient.getChat();
      const abortController = new AbortController();
      
      // Подготавливаем историю для chat объекта
      const chatHistory: Content[] = [];
      
      // Добавляем историю чата, если есть (фильтруем технические сообщения)
      if (options.aiContext?.chatHistory && options.aiContext.chatHistory.length > 0) {
        logger.info(`Loading ${options.aiContext.chatHistory.length} messages from chat history`);
        
        // Фильтруем только нормальные сообщения (не технические JSON)
        const filteredHistory = options.aiContext.chatHistory.filter(msg => {
          // Исключаем технические сообщения
          if (msg.content.startsWith('{"type":"') && msg.content.includes('"timestamp"')) {
            return false;
          }
          // Исключаем пустые сообщения
          if (!msg.content.trim()) {
            return false;
          }
          return true;
        });
        
        logger.info(`Filtered to ${filteredHistory.length} normal messages (excluded ${options.aiContext.chatHistory.length - filteredHistory.length} technical messages)`);
        
        // Конвертируем отфильтрованную историю чата в формат Content
        for (const msg of filteredHistory) {
          chatHistory.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
      
      // Устанавливаем историю в chat объект
      chat.setHistory(chatHistory);
      
      // Текущее сообщение будем отправлять отдельно
      const currentMessage = { role: 'user', parts: [{ text: input }] };
      
      // Логируем контекст, который отправляется в AI
      logger.info('🤖 AI Context Summary:');
      logger.info(`   - Total messages in history: ${chatHistory.length}`);
      logger.info(`   - Current user input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);
      logger.info(`   - History messages: ${chatHistory.map(m => {
        const text = m.parts?.[0]?.text || 'No text';
        return `${m.role}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;
      }).join(', ')}`);
      
      const turnCount = 0;
      const responseText = '';
      const toolCalls: Array<{
        name: string;
        args: Record<string, unknown>;
        result?: string;
        error?: string;
      }> = [];

      if (isStream) {
        return this.processStream(
          chat, toolRegistry, currentMessage, turnCount, responseText, toolCalls, 
          prompt_id, abortController, sessionId, projectPath, config, options
        );
      } else {
        return this.processSync(
          chat, toolRegistry, currentMessage, turnCount, responseText, toolCalls,
          prompt_id, abortController, sessionId, projectPath, config, options
        );
      }
    } catch (error) {
      logger.error('Error in AI Service processWithAI:', error instanceof Error ? error.message : String(error));
      
      if (isStream) {
        return (async function* (): AsyncGenerator<AIStreamEvent> {
          yield {
            type: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error)
          };
        })();
      } else {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        };
      }
    }
  }

  /**
   * Синхронная обработка сообщения
   */
  private async processSync(
    chat: GeminiChat,
    toolRegistry: ToolRegistry,
    currentMessage: Content,
    turnCount: number,
    responseText: string,
    toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string; error?: string; }>,
    prompt_id: string,
    abortController: AbortController,
    _sessionId: string,
    _projectPath: string,
    config: Config,
    _options: Partial<AIServiceOptions> = {}
  ): Promise<AIResponse> {
    while (turnCount < 10) {
      turnCount++;
      const functionCalls: FunctionCall[] = [];

      // Отправляем текущее сообщение - история уже установлена в chat
      const responseStream = await chat.sendMessageStream(
        {
          message: currentMessage.parts || [],
          config: {
            abortSignal: abortController.signal,
            tools: [
              { functionDeclarations: toolRegistry.getFunctionDeclarations() },
            ],
          },
        },
        prompt_id,
      );

      for await (const resp of responseStream) {
        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }
        const textPart = this.getResponseText(resp);
        if (textPart) {
          responseText += textPart;
        }
        if (resp.functionCalls) {
          functionCalls.push(...resp.functionCalls);
        }
      }
      
      // Логируем ответ AI
      logger.info('🤖 AI Response:');
      logger.info(`   - Response text: "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
      logger.info(`   - Function calls: ${functionCalls.length}`);
      if (functionCalls.length > 0) {
        logger.info(`   - Functions to execute: ${functionCalls.map(fc => fc.name).join(', ')}`);
      }

      if (functionCalls.length > 0) {
        const toolResponseParts: Part[] = [];

        for (const fc of functionCalls) {
          const callId = fc.id ?? `${fc.name}-${Date.now()}`;
          const requestInfo: ToolCallRequestInfo = {
            callId,
            name: fc.name || '',
            args: (fc.args ?? {}) as Record<string, unknown>,
            isClientInitiated: false,
            prompt_id,
          };

          logger.info(`🔧 [${new Date().toISOString()}] Вызов инструмента: ${fc.name}`);
          logger.debug('📋 Аргументы:', JSON.stringify(fc.args, null, 2));

          // Выполняем инструмент через стандартный обработчик
          // Теперь run_shell_command будет использовать наш кастомный инструмент
          const toolResponse = await RetryUtils.executeWithRetry(
            () => executeToolCall(config, requestInfo, toolRegistry, abortController.signal),
            { maxRetries: 2 }
          );

          const toolCall: {
            name: string;
            args: Record<string, unknown>;
            result?: string;
            error?: string;
          } = {
            name: fc.name || '',
            args: (fc.args ?? {}) as Record<string, unknown>,
          };

          if (toolResponse.error) {
            const isToolNotFound = toolResponse.error.message.includes('not found in registry');
            logger.error(`❌ [${new Date().toISOString()}] Ошибка инструмента ${fc.name}:`, toolResponse.error.message);
            toolCall.error = toolResponse.error.message;
            if (!isToolNotFound) {
              throw new Error(`Error executing tool ${fc.name}: ${toolResponse.error.message}`);
            }
          } else {
            logger.info(`✅ [${new Date().toISOString()}] Инструмент ${fc.name} выполнен успешно`);
            if (toolResponse.resultDisplay && typeof toolResponse.resultDisplay === 'string') {
              toolCall.result = toolResponse.resultDisplay;
              logger.debug(`📄 Результат: ${toolResponse.resultDisplay.substring(0, 200)}${toolResponse.resultDisplay.length > 200 ? '...' : ''}`);
            }
          }

          toolCalls.push(toolCall);

          if (toolResponse.responseParts) {
            const parts = Array.isArray(toolResponse.responseParts)
              ? toolResponse.responseParts
              : [toolResponse.responseParts];
            for (const part of parts) {
              if (typeof part === 'string') {
                toolResponseParts.push({ text: part });
              } else if (part) {
                toolResponseParts.push(part);
              }
            }
          }
        }

        // Для следующего поворота используем результат инструментов
        const nextMessage = { role: 'user', parts: toolResponseParts };
        return this.processSync(chat, toolRegistry, nextMessage, turnCount, responseText, toolCalls, prompt_id, abortController, _sessionId, _projectPath, config);
      } else {
        return {
          success: true,
          response: responseText,
          timestamp: new Date().toISOString(),
          tools: toolCalls.length > 0 ? toolCalls : undefined
        };
      }
    }

    return {
      success: false,
      error: 'Достигнуто максимальное количество поворотов для этой сессии',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Стриминговая обработка сообщения
   */
  private async *processStream(
    chat: GeminiChat,
    toolRegistry: ToolRegistry,
    currentMessage: Content,
    turnCount: number,
    responseText: string,
    toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string; error?: string; }>,
    prompt_id: string,
    abortController: AbortController,
    _sessionId: string,
    _projectPath: string,
    config: Config,
    options: Partial<AIServiceOptions> = {}
  ): AsyncGenerator<AIStreamEvent> {
    yield {
      type: 'start',
      timestamp: new Date().toISOString(),
      content: 'Начинаем обработку запроса...'
    };

    while (turnCount < 10) {
      turnCount++;
      const functionCalls: FunctionCall[] = [];
      let responseText = '';

      // Отправляем текущее сообщение - история уже установлена в chat
      const responseStream = await chat.sendMessageStream(
        {
          message: currentMessage.parts || [],
          config: {
            abortSignal: abortController.signal,
            tools: [
              { functionDeclarations: toolRegistry.getFunctionDeclarations() },
            ],
          },
        },
        prompt_id,
      );

      for await (const resp of responseStream) {
        if (abortController.signal.aborted) {
          yield {
            type: 'error',
            timestamp: new Date().toISOString(),
            error: 'Операция отменена'
          };
          return;
        }

        const textPart = this.getResponseText(resp);
        if (textPart) {
          responseText += textPart;
          logger.debug(`📝 AI text part: "${textPart.substring(0, 100)}${textPart.length > 100 ? '...' : ''}"`);
          yield {
            type: 'content',
            timestamp: new Date().toISOString(),
            content: textPart
          };
        } else {
          logger.debug('📝 AI response part has no text content');
        }

        if (resp.functionCalls) {
          functionCalls.push(...resp.functionCalls);
        }
      }
      
      // Логируем ответ AI в стриме
      logger.info('🤖 AI Stream Response:');
      logger.info(`   - Response text: "${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}"`);
      logger.info(`   - Response length: ${responseText.length} characters`);
      logger.info(`   - Function calls: ${functionCalls.length}`);
      if (functionCalls.length > 0) {
        logger.info(`   - Functions to execute: ${functionCalls.map(fc => fc.name).join(', ')}`);
      }
      
      // Если ответ пустой, логируем это
      if (!responseText.trim()) {
        logger.warn('⚠️ AI returned empty response text');
      }

      if (functionCalls.length > 0) {
        yield {
          type: 'tools_start',
          timestamp: new Date().toISOString(),
          tools: functionCalls.map(fc => ({ name: fc.name || '', args: fc.args || {} }))
        };

        const toolResponseParts: Part[] = [];

        for (const fc of functionCalls) {
          const callId = fc.id ?? `${fc.name}-${Date.now()}`;
          const requestInfo: ToolCallRequestInfo = {
            callId,
            name: fc.name || '',
            args: (fc.args ?? {}) as Record<string, unknown>,
            isClientInitiated: false,
            prompt_id,
          };

          yield {
            type: 'tool_start',
            timestamp: new Date().toISOString(),
            tool: { name: fc.name || '', args: fc.args || {} }
          };

          // Выполняем инструмент через стандартный обработчик
          // Теперь run_shell_command будет использовать наш кастомный инструмент
          const toolResponse = await RetryUtils.executeWithRetry(
            () => executeToolCall(config, requestInfo, toolRegistry, abortController.signal),
            { maxRetries: 2 }
          );

          const toolCall: {
            name: string;
            args: Record<string, unknown>;
            result?: string;
            error?: string;
          } = {
            name: fc.name || '',
            args: (fc.args ?? {}) as Record<string, unknown>,
          };

          if (toolResponse.error) {
            const isToolNotFound = toolResponse.error.message.includes('not found in registry');
            toolCall.error = toolResponse.error.message;
            
            yield {
              type: 'tool_error',
              timestamp: new Date().toISOString(),
              tool: { name: fc.name || '', error: toolResponse.error.message }
            };

            if (!isToolNotFound) {
              yield {
                type: 'error',
                timestamp: new Date().toISOString(),
                error: `Ошибка выполнения инструмента ${fc.name}: ${toolResponse.error.message}`
              };
              return;
            }
          } else {
            if (toolResponse.resultDisplay && typeof toolResponse.resultDisplay === 'string') {
              toolCall.result = toolResponse.resultDisplay;
              
              yield {
                type: 'tool_success',
                timestamp: new Date().toISOString(),
                tool: { name: fc.name || '', result: toolResponse.resultDisplay }
              };
            }
          }

          toolCalls.push(toolCall);

          if (toolResponse.responseParts) {
            const parts = Array.isArray(toolResponse.responseParts)
              ? toolResponse.responseParts
              : [toolResponse.responseParts];
            for (const part of parts) {
              if (typeof part === 'string') {
                toolResponseParts.push({ text: part });
              } else if (part) {
                toolResponseParts.push(part);
              }
            }
          }
        }

        yield {
          type: 'tools_complete',
          timestamp: new Date().toISOString(),
          tools: toolCalls
        };

        // Для следующего поворота используем результат инструментов
        const nextMessage = { role: 'user', parts: toolResponseParts };
        yield* this.processStream(chat, toolRegistry, nextMessage, turnCount, responseText, toolCalls, prompt_id, abortController, _sessionId, _projectPath, config, options);
      } else {
        yield {
          type: 'complete',
          timestamp: new Date().toISOString(),
          final_response: responseText
        };
        return;
      }
    }
  }

  /**
   * Обработка сообщения (синхронная)
   */
  async processMessage(input: string, options: Partial<AIServiceOptions> = {}): Promise<AIResponse> {
    const result = await this.processWithAI(input, options, false);
    return result as AIResponse;
  }

  /**
   * Обработка сообщения (стриминг)
   */
  async *processMessageStream(input: string, options: Partial<AIServiceOptions> = {}): AsyncGenerator<AIStreamEvent> {
    const result = await this.processWithAI(input, options, true);
    yield* result as AsyncGenerator<AIStreamEvent>;
  }

  /**
   * Проверка здоровья сервиса
   */
  async getHealth(): Promise<{ status: string; model: string; initialized: boolean; cacheSize: number }> {
    return {
      status: this.configCache.size > 0 ? 'healthy' : 'not_initialized',
      model: DEFAULT_GEMINI_FLASH_MODEL,
      initialized: this.configCache.size > 0,
      cacheSize: this.configCache.size
    };
  }

  /**
   * Получение конфигурации сервиса
   */
  async getConfig(): Promise<{ model: string; working_directory: string; supported_options: Record<string, string>; cacheInfo: { size: number; ttl: number } }> {
    return {
      model: DEFAULT_GEMINI_FLASH_MODEL,
      working_directory: PathManager.getWorkspacePath(),
      supported_options: {
        projectPath: 'Путь к проекту для работы (опционально)',
        fullContext: 'Загружать полный контекст проекта (boolean)',
        model: 'Модель Gemini для использования',
        debugMode: 'Включить режим отладки',
        sessionId: 'ID сессии для кэширования'
      },
      cacheInfo: {
        size: this.configCache.size,
        ttl: this.CACHE_TTL
      }
    };
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.configCache.clear();
    logger.info('AI Service cache cleared');
  }
} 