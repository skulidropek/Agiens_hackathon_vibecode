import { ToolRegistry } from '@google/gemini-cli-core';
import { Config } from '@google/gemini-cli-core';
import { CustomTerminalTool } from './custom-terminal-tool';
import { TerminalService } from './terminal-service';
import { logger } from '../utils/logger';

export class CustomToolRegistry {
  private readonly config: Config;
  private readonly terminalService: TerminalService;
  private readonly toolRegistry: ToolRegistry;

  constructor(config: Config, terminalService: TerminalService, toolRegistry: ToolRegistry) {
    this.config = config;
    this.terminalService = terminalService;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Регистрирует кастомные инструменты, заменяя стандартные
   */
  registerCustomTools(projectId?: string): void {
    logger.info('CustomToolRegistry: Registering custom tools');

    // Проверяем, есть ли уже стандартный инструмент
    const existingTool = this.toolRegistry.getTool(CustomTerminalTool.Name);
    if (existingTool) {
      logger.info('CustomToolRegistry: Found existing tool', {
        toolName: CustomTerminalTool.Name,
        toolType: existingTool.constructor.name
      });
    }

    // Создаем и регистрируем кастомный терминальный инструмент
    const customTerminalTool = new CustomTerminalTool(
      this.config,
      this.terminalService,
      projectId || 'default-project'
    );

    // Регистрируем инструмент с тем же именем, что и стандартный
    this.toolRegistry.registerTool(customTerminalTool);

    // Проверяем, что инструмент зарегистрирован
    const registeredTool = this.toolRegistry.getTool(CustomTerminalTool.Name);
    logger.info('CustomToolRegistry: Tool registration result', {
      toolName: CustomTerminalTool.Name,
      isRegistered: !!registeredTool,
      toolType: registeredTool?.constructor.name,
      isCustomTool: registeredTool instanceof CustomTerminalTool
    });

    logger.info('CustomToolRegistry: Custom terminal tool registered successfully', {
      toolName: CustomTerminalTool.Name,
      projectId: projectId || 'default-project'
    });
  }

  /**
   * Проверяет, зарегистрирован ли кастомный инструмент
   */
  isCustomToolRegistered(toolName: string): boolean {
    const tool = this.toolRegistry.getTool(toolName);
    return tool instanceof CustomTerminalTool;
  }

  /**
   * Получает список всех зарегистрированных инструментов
   */
  getAllRegisteredTools(): string[] {
    return Array.from(this.toolRegistry.getAllTools()).map(tool => tool.name);
  }
} 