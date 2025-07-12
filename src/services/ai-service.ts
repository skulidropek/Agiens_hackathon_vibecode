import type { FunctionCall, GenerateContentResponse, Content, Part } from '@google/genai';
import { ToolCallRequestInfo, executeToolCall } from '@google/gemini-cli-core';
import { Config, ApprovalMode, DEFAULT_GEMINI_FLASH_MODEL, DEFAULT_GEMINI_EMBEDDING_MODEL, AuthType } from '@google/gemini-cli-core';
import { logger } from '../utils/logger';

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

export class AIService {
  private config: Config | null = null;

  async initialize(options: AIServiceOptions): Promise<void> {
    try {
      this.config = await this.createCoreConfig(options);
      logger.info(`AI Service initialized for session: ${options.sessionId}`);
    } catch (error) {
      logger.error('Failed to initialize AI Service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createCoreConfig(options: AIServiceOptions): Promise<Config> {
    const workingDir = options.projectPath || options.cwd || process.cwd();
    
    const config = new Config({
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
    });

    await config.initialize();
    await config.refreshAuth(AuthType.LOGIN_WITH_GOOGLE);
    
    return config;
  }

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
        return candidate.content.parts
          .filter((part) => part.text)
          .map((part) => part.text)
          .join('');
      }
    }
    return null;
  }

  async processMessage(input: string, options: Partial<AIServiceOptions> = {}): Promise<AIResponse> {
    if (!this.config) {
      throw new Error('AI Service not initialized');
    }

    try {
      const projectPath = options.projectPath || process.cwd();
      
      // Создаем новую конфигурацию для каждого запроса
      const config = await this.createCoreConfig({ 
        sessionId: `api-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fullContext: options.fullContext || false,
        cwd: projectPath
      });
      
      await config.initialize();
      
      const prompt_id = `api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      
      const geminiClient = config.getGeminiClient();
      const toolRegistry = await config.getToolRegistry();

      const chat = await geminiClient.getChat();
      const abortController = new AbortController();
      let currentMessages: Content[] = [{ role: 'user', parts: [{ text: input }] }];
      let turnCount = 0;
      let responseText = '';
      const toolCalls: Array<{
        name: string;
        args: Record<string, unknown>;
        result?: string;
        error?: string;
      }> = [];
      
      while (turnCount < 10) {
        turnCount++;
        const functionCalls: FunctionCall[] = [];

        const responseStream = await chat.sendMessageStream(
          {
            message: currentMessages[0]?.parts || [],
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

            const toolResponse = await executeToolCall(
              config,
              requestInfo,
              toolRegistry,
              abortController.signal,
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
              const isToolNotFound = toolResponse.error.message.includes(
                'not found in registry',
              );
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

          currentMessages = [{ role: 'user', parts: toolResponseParts }];
        } else {
          return {
            success: true,
            response: responseText,
            timestamp: new Date().toISOString(),
            tools: toolCalls.length > 0 ? toolCalls : undefined
          };
        }
      }
      // Если цикл завершился без return, возвращаем ошибку
      return {
        success: false,
        error: 'Достигнуто максимальное количество поворотов для этой сессии',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in AI Service processMessage:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
    }
  }

  async *processMessageStream(input: string, options: Partial<AIServiceOptions> = {}): AsyncGenerator<AIStreamEvent> {
    if (!this.config) {
      throw new Error('AI Service not initialized');
    }

    try {
      const projectPath = options.projectPath || process.cwd();
      
      const config = await this.createCoreConfig({ 
        sessionId: `api-stream-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fullContext: options.fullContext || false,
        cwd: projectPath
      });
      
      await config.initialize();
      
      const prompt_id = `api-stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      
      const geminiClient = config.getGeminiClient();
      const toolRegistry = await config.getToolRegistry();

      const chat = await geminiClient.getChat();
      const abortController = new AbortController();
      let currentMessages: Content[] = [{ role: 'user', parts: [{ text: input }] }];
      let turnCount = 0;
      
      yield {
        type: 'start',
        timestamp: new Date().toISOString(),
        content: 'Начинаем обработку запроса...'
      };
      
      while (turnCount < 10) {
        turnCount++;
        const functionCalls: FunctionCall[] = [];
        let responseText = '';

        const responseStream = await chat.sendMessageStream(
          {
            message: currentMessages[0]?.parts || [],
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
            yield {
              type: 'content',
              timestamp: new Date().toISOString(),
              content: textPart
            };
          }

          if (resp.functionCalls) {
            functionCalls.push(...resp.functionCalls);
          }
        }

        if (functionCalls.length > 0) {
          yield {
            type: 'tools_start',
            timestamp: new Date().toISOString(),
            tools: functionCalls.map(fc => ({ name: fc.name || '', args: fc.args || {} }))
          };

          const toolResponseParts: Part[] = [];
          const toolCalls: Array<{
            name: string;
            args: Record<string, unknown>;
            result?: string;
            error?: string;
          }> = [];

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

            const toolResponse = await executeToolCall(
              config,
              requestInfo,
              toolRegistry,
              abortController.signal,
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
              const isToolNotFound = toolResponse.error.message.includes(
                'not found in registry',
              );
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

          currentMessages = [{ role: 'user', parts: toolResponseParts }];
        } else {
          yield {
            type: 'complete',
            timestamp: new Date().toISOString(),
            final_response: responseText
          };
          return;
        }
      }
    } catch (error) {
      logger.error('Error in AI Service processMessageStream:', error instanceof Error ? error.message : String(error));
      yield {
        type: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getHealth(): Promise<{ status: string; model: string; initialized: boolean }> {
    return {
      status: this.config ? 'healthy' : 'not_initialized',
      model: DEFAULT_GEMINI_FLASH_MODEL,
      initialized: !!this.config
    };
  }

  async getConfig(): Promise<{ model: string; working_directory: string; supported_options: Record<string, string> }> {
    return {
      model: DEFAULT_GEMINI_FLASH_MODEL,
      working_directory: process.cwd(),
      supported_options: {
        projectPath: 'Путь к проекту для работы (опционально)',
        fullContext: 'Загружать полный контекст проекта (boolean)',
        model: 'Модель Gemini для использования',
        debugMode: 'Включить режим отладки'
      }
    };
  }
} 