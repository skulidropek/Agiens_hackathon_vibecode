import { Config, ToolRegistry } from '@google/gemini-cli-core';
import { CustomTerminalTool } from './custom-terminal-tool';
import { TerminalService } from './terminal-service';
import { logger } from '../utils/logger';

export class CustomConfig extends Config {
  private readonly terminalService: TerminalService;
  private readonly projectId: string;

  constructor(
    params: ConstructorParameters<typeof Config>[0],
    terminalService: TerminalService,
    projectId: string = 'default-project'
  ) {
    super(params);
    this.terminalService = terminalService;
    this.projectId = projectId;
    
    logger.info('CustomConfig: Constructor called', {
      projectId: this.projectId,
      targetDir: params.targetDir,
      cwd: params.cwd
    });
  }

  async createToolRegistry(): Promise<ToolRegistry> {
    logger.info('CustomConfig: Creating custom tool registry');

    // Создаем стандартный ToolRegistry
    const registry = await super.createToolRegistry();

    logger.info('CustomConfig: Standard tool registry created', {
      totalTools: registry.getAllTools().length,
      toolNames: registry.getAllTools().map(t => t.name)
    });

    // Создаем и регистрируем наш кастомный терминальный инструмент
    logger.info('CustomConfig: Creating CustomTerminalTool', {
      projectId: this.projectId
    });
    
    const customTerminalTool = new CustomTerminalTool(
      this,
      this.terminalService,
      this.projectId
    );

    // Регистрируем инструмент с тем же именем, что и стандартный
    registry.registerTool(customTerminalTool);

    logger.info('CustomConfig: Custom terminal tool registered successfully', {
      toolName: CustomTerminalTool.Name,
      projectId: this.projectId,
      totalTools: registry.getAllTools().length,
      finalToolNames: registry.getAllTools().map(t => t.name),
      constructorProjectId: this.projectId
    });

    return registry;
  }
} 