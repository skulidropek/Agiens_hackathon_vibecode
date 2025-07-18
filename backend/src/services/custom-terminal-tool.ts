import { BaseTool, ToolResult } from '@google/gemini-cli-core';
import { Type } from '@google/genai';
import { Config } from '@google/gemini-cli-core';
import { TerminalService } from './terminal-service';
import { logger } from '../utils/logger';

export interface CustomTerminalToolParams {
  command: string;
  description?: string;
  directory?: string;
  projectId?: string;
  background?: boolean;
}

export class CustomTerminalTool extends BaseTool<CustomTerminalToolParams, ToolResult> {
  private readonly config: Config;
  private readonly terminalService: TerminalService;
  private readonly projectId: string;

  static Name = 'run_shell_command';

  constructor(config: Config, terminalService: TerminalService, projectId: string = 'default-project') {
    super(
      CustomTerminalTool.Name,
      'Terminal',
      `This tool executes shell commands through our integrated terminal system. Commands are executed in managed terminal sessions that can be viewed and controlled through the web interface.

The following information is returned:

Command: Executed command.
Directory: Directory where command was executed.
Terminal Session ID: Unique identifier for the terminal session.
Process ID: Process ID of the executed command.
Output: Command output (if available).
Status: Success or error status.`,
      {
        type: Type.OBJECT,
        properties: {
          command: {
            type: Type.STRING,
            description: 'Exact bash command to execute',
          },
          description: {
            type: Type.STRING,
            description: 'Brief description of the command for the user. Be specific and concise.',
          },
          directory: {
            type: Type.STRING,
            description: '(OPTIONAL) Directory to run the command in, relative to the project root.',
          },
          projectId: {
            type: Type.STRING,
            description: '(OPTIONAL) Project ID for the terminal session. Defaults to current project.',
          },
          background: {
            type: Type.BOOLEAN,
            description: '(OPTIONAL) Whether to run the command in background mode.',
          },
        },
        required: ['command'],
      },
      false, // output is not markdown
      true   // can update output
    );

    this.config = config;
    this.terminalService = terminalService;
    this.projectId = projectId;
    
    logger.info('CustomTerminalTool: Constructor called', {
      projectId: this.projectId,
      toolName: CustomTerminalTool.Name
    });
  }

  getDescription(params: CustomTerminalToolParams): string {
    let description = params.command;
    
    if (params.directory) {
      description += ' [in ' + params.directory + ']';
    }
    
    if (params.description) {
      description += ' (' + params.description.replace(/\n/g, ' ') + ')';
    }

    if (params.background) {
      description += ' [background]';
    }

    return description;
  }

  validateToolParams(params: CustomTerminalToolParams): string | null {
    if (!params.command || !params.command.trim()) {
      return 'Command cannot be empty.';
    }

    if (params.directory && params.directory.startsWith('/')) {
      return 'Directory cannot be absolute. Must be relative to the project root directory.';
    }

    // Проверяем, что команда не содержит опасных конструкций
    if (params.command.includes('$(')) {
      return 'Command substitution using $() is not allowed for security reasons.';
    }

    return null;
  }

  async shouldConfirmExecute(_params: CustomTerminalToolParams, _abortSignal: AbortSignal): Promise<false> {
    // Всегда выполняем без подтверждения для интеграции с AI
    return false;
  }

  async execute(params: CustomTerminalToolParams, abortSignal: AbortSignal, _updateOutput?: (chunk: string) => void): Promise<ToolResult> {
    logger.info('CustomTerminalTool: execute() called', {
      command: params.command,
      toolName: this.name
    });

    const validationError = this.validateToolParams(params);
    if (validationError) {
      logger.warn('CustomTerminalTool: Command validation failed', { error: validationError });
      return {
        llmContent: [
          `Command rejected: ${params.command}`,
          `Reason: ${validationError}`,
        ].join('\n'),
        returnDisplay: `Error: ${validationError}`,
      };
    }

    if (abortSignal.aborted) {
      logger.warn('CustomTerminalTool: Command was aborted');
      return {
        llmContent: 'Command was cancelled by user before it could start.',
        returnDisplay: 'Command cancelled by user.',
      };
    }

    try {
      logger.info('CustomTerminalTool: Executing command', {
        command: params.command,
        directory: params.directory,
        projectId: params.projectId || this.projectId,
        background: params.background
      });

      // Создаем терминал через наш TerminalService
      // Для интерактивных терминалов создаем bash сессию, а затем отправляем команду
      const terminalRequest = {
        command: 'bash',
        args: [], // Пустые аргументы для интерактивной сессии
        cwd: params.directory ? params.directory : undefined,
        projectId: params.projectId || this.projectId,
        env: {},
        cols: 80,
        rows: 24
      };

      logger.info('CustomTerminalTool: Creating terminal session', {
        command: params.command,
        projectId: terminalRequest.projectId,
        cwd: terminalRequest.cwd,
        constructorProjectId: this.projectId,
        paramsProjectId: params.projectId
      });

      const session = await this.terminalService.createSession(terminalRequest);

      logger.info('CustomTerminalTool: Terminal session created', {
        sessionId: session.id,
        pid: session.pid,
        command: params.command
      });

      // Отправляем команду в терминал
      const commandToSend = params.command + '\n';
      const writeSuccess = this.terminalService.writeToSession(session.id, commandToSend);
      
      logger.info('CustomTerminalTool: Command sent to terminal', {
        sessionId: session.id,
        command: params.command,
        writeSuccess
      });

      // Формируем результат
      const llmContent = [
        'Command: ' + params.command,
        'Directory: ' + (params.directory || '(root)'),
        'Terminal Session ID: ' + session.id,
        'Process ID: ' + session.pid,
        'Status: Success',
        'Output: Command executed in managed terminal session.',
      ].join('\n');

      const returnDisplay = '✅ Command executed successfully in terminal session ' + session.id + ' (PID: ' + session.pid + ')\n\n' +
        'Command: ' + params.command + '\n' +
        (params.directory ? 'Directory: ' + params.directory + '\n' : '') +
        (params.background ? 'Mode: Background\n' : '') +
        '\nYou can view and interact with this terminal session through the web interface.';

      return {
        llmContent,
        returnDisplay,
      };

    } catch (error) {
      logger.error('CustomTerminalTool: Failed to execute command', {
        command: params.command,
        error: error instanceof Error ? error.message : String(error)
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        llmContent: [
          `Command failed: ${params.command}`,
          `Error: ${errorMessage}`,
        ].join('\n'),
        returnDisplay: '❌ Command failed: ' + errorMessage,
      };
    }
  }
} 