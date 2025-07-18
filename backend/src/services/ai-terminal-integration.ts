import { TerminalService, CreateTerminalRequest } from './terminal-service';
import { logger } from '../utils/logger';

export interface AITerminalCommand {
  command: string;
  description?: string;
  projectId: string;
  cwd?: string;
  background?: boolean;
}

export interface AITerminalResult {
  success: boolean;
  sessionId?: string;
  output?: string;
  error?: string;
  pid?: number;
}

export class AITerminalIntegration {
  private terminalService: TerminalService;
  private activeSessions = new Map<string, { sessionId: string; pid: number }>();

  constructor(terminalService: TerminalService) {
    this.terminalService = terminalService;
  }

  /**
   * Выполнить команду через наш TerminalService
   */
  async executeCommand(request: AITerminalCommand): Promise<AITerminalResult> {
    try {
      logger.info('AI Terminal Integration: Executing command', {
        command: request.command,
        projectId: request.projectId,
        cwd: request.cwd,
        background: request.background
      });

      // Создаем терминал через наш TerminalService
      const terminalRequest: CreateTerminalRequest = {
        command: 'bash',
        args: ['-c', request.command],
        cwd: request.cwd,
        projectId: request.projectId,
        env: {},
        cols: 80,
        rows: 24
      };

      const session = await this.terminalService.createSession(terminalRequest);
      
      // Сохраняем информацию о сессии
      this.activeSessions.set(session.id, {
        sessionId: session.id,
        pid: session.pid
      });

      logger.info('AI Terminal Integration: Terminal session created', {
        sessionId: session.id,
        pid: session.pid,
        command: request.command
      });

      return {
        success: true,
        sessionId: session.id,
        pid: session.pid,
        output: `Terminal session created with ID: ${session.id}, PID: ${session.pid}. Команда выполнена в терминале.`
      };

    } catch (error) {
      logger.error('AI Terminal Integration: Failed to execute command', {
        command: request.command,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Получить список активных сессий AI
   */
  getActiveSessions(): Array<{ sessionId: string; pid: number }> {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Завершить сессию
   */
  async killSession(sessionId: string): Promise<boolean> {
    try {
      const success = this.terminalService.killSession(sessionId);
      if (success) {
        this.activeSessions.delete(sessionId);
      }
      return success;
    } catch (error) {
      logger.error('AI Terminal Integration: Failed to kill session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Получить статистику сессий
   */
  getStats() {
    const allSessions = this.terminalService.getAllSessions();
    const aiSessions = allSessions.filter(session => 
      this.activeSessions.has(session.id)
    );

    return {
      totalSessions: allSessions.length,
      aiSessions: aiSessions.length,
      activeAISessions: aiSessions.filter(s => s.isActive).length
    };
  }
} 