import { AIService, AIServiceOptions, AIResponse, AIStreamEvent } from './ai-service';
import { ProjectService } from './project-service';
import { ProjectChatService } from './project-chat-service';
import { AIContext } from '../types';
import { logger } from '../utils/logger';
import { PathManager } from '../utils/path-manager';
import { RetryUtils } from '../utils/retry-utils';

export interface ProjectAIOptions {
  projectId: string;
  sessionId?: string;
  conversationId?: string;
  fullContext?: boolean;
  model?: string;
  debugMode?: boolean;
}

import { TerminalService } from './terminal-service';

export class ProjectAIService {
  private aiService: AIService;
  public projectService: ProjectService;
  private projectChatService: ProjectChatService;
  private terminalService: TerminalService;

  constructor(projectService: ProjectService, terminalService: TerminalService) {
    this.aiService = new AIService(terminalService);
    this.projectService = projectService;
    this.projectChatService = new ProjectChatService(projectService);
    this.terminalService = terminalService;
  }

  async initialize(options: ProjectAIOptions): Promise<void> {
    try {
      // Получаем информацию о проекте
      const project = await this.projectService.getProject(options.projectId);
      if (!project) {
        throw new Error(`Проект с ID ${options.projectId} не найден`);
      }

      const projectPath = PathManager.getProjectPath(project.name);
      
      const aiOptions: AIServiceOptions = {
        sessionId: options.sessionId || `project-${options.projectId}-${Date.now()}`,
        projectPath,
        fullContext: options.fullContext || false,
        model: options.model,
        debugMode: options.debugMode || false,
      };

      await this.aiService.initialize(aiOptions);
      logger.info(`Project AI Service initialized for project: ${options.projectId}`);
    } catch (error) {
      logger.error('Failed to initialize Project AI Service:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async processMessage(message: string, options: ProjectAIOptions): Promise<AIResponse> {
    try {
      // Получаем информацию о проекте
      const project = await this.projectService.getProject(options.projectId);
      if (!project) {
        return {
          success: false,
          error: `Проект с ID ${options.projectId} не найден`,
          timestamp: new Date().toISOString(),
        };
      }

      const projectPath = PathManager.getProjectPath(project.name);
      
      // Загружаем контекст чата, если указан conversationId
      let aiContext: AIContext | undefined = undefined;
      if (options.conversationId) {
        aiContext = await this.projectChatService.getAIContext(options.projectId, options.conversationId);
        logger.info(`Loaded AI context for conversation ${options.conversationId}: ${aiContext.chatHistory.length} messages`);
      }
      
      const aiOptions = {
        projectPath,
        fullContext: options.fullContext || false,
        model: options.model,
        debugMode: options.debugMode || false,
        sessionId: options.sessionId || `project-${options.projectId}-${Date.now()}`,
        aiContext, // Передаем контекст в AI сервис
      };

      return await RetryUtils.executeWithRetry(
        () => this.aiService.processMessage(message, aiOptions),
        { maxRetries: 2 }
      );
    } catch (error) {
      logger.error('Error in Project AI Service processMessage:', error instanceof Error ? error.message : String(error));
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  async *processMessageStream(message: string, options: ProjectAIOptions): AsyncGenerator<AIStreamEvent> {
    try {
      // Получаем информацию о проекте
      const project = await this.projectService.getProject(options.projectId);
      if (!project) {
        yield {
          type: 'error',
          timestamp: new Date().toISOString(),
          error: `Проект с ID ${options.projectId} не найден`
        };
        return;
      }

      const projectPath = PathManager.getProjectPath(project.name);
      
      // Загружаем контекст чата, если указан conversationId
      let aiContext: AIContext | undefined = undefined;
      if (options.conversationId) {
        aiContext = await this.projectChatService.getAIContext(options.projectId, options.conversationId);
        logger.info(`Loaded AI context for conversation ${options.conversationId}: ${aiContext.chatHistory.length} messages`);
      }
      
      const aiOptions = {
        projectPath,
        fullContext: options.fullContext || false,
        model: options.model,
        debugMode: options.debugMode || false,
        sessionId: options.sessionId || `project-${options.projectId}-${Date.now()}`,
        aiContext, // Передаем контекст в AI сервис
      };

      yield* this.aiService.processMessageStream(message, aiOptions);
    } catch (error) {
      logger.error('Error in Project AI Service processMessageStream:', error instanceof Error ? error.message : String(error));
      yield {
        type: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async getHealth(projectId: string): Promise<{ status: string; model: string; initialized: boolean; project?: import('../types/project').Project | undefined; cacheSize: number }> {
    try {
      const project = await this.projectService.getProject(projectId);
      const health = await this.aiService.getHealth();
      
      return {
        ...health,
        project: project || undefined
      };
    } catch (error) {
      logger.error('Error getting Project AI health:', error instanceof Error ? error.message : String(error));
      return {
        status: 'error',
        model: 'unknown',
        initialized: false,
        cacheSize: 0
      };
    }
  }

  async getConfig(projectId: string): Promise<{ model: string; working_directory: string; project?: import('../types/project').Project | undefined; supported_options: Record<string, string>; cacheInfo: { size: number; ttl: number } }> {
    try {
      const project = await this.projectService.getProject(projectId);
      const config = await this.aiService.getConfig();
      
      return {
        ...config,
        project: project || undefined
      };
    } catch (error) {
      logger.error('Error getting Project AI config:', error instanceof Error ? error.message : String(error));
      return {
        model: 'unknown',
        working_directory: 'unknown',
        supported_options: {},
        cacheInfo: { size: 0, ttl: 0 }
      };
    }
  }

  /**
   * Очистка кэша AI сервиса
   */
  clearCache(): void {
    this.aiService.clearCache();
  }
} 