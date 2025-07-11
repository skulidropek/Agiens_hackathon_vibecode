import { spawn } from 'node-pty';
import { WebSocketConnection, TerminalInput, TerminalCommand, TerminalOutput, TerminalStatus } from '../types';
import { logger } from '../utils/logger';
import { AppConfig } from '../config/app-config';
import { v4 as uuidv4 } from 'uuid';

const config = new AppConfig();

interface TerminalSession {
  id: string;
  process: import('node-pty').IPty;
  connection: WebSocketConnection;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  workingDirectory: string;
  history: string[];
}

export class TerminalHandler {
  private sessions = new Map<string, TerminalSession>();
  private readonly maxHistoryLength = 1000;

  constructor() {
    // Очистка неактивных сессий каждые 5 минут
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  public async handleInput(connection: WebSocketConnection, message: TerminalInput): Promise<void> {
    const session = this.getOrCreateSession(connection);
    
    if (!session) {
      this.sendErrorMessage(connection, 'Failed to create terminal session', 'SESSION_ERROR');
      return;
    }

    try {
      // Отправляем ввод в терминал
      session.process.write(message.data);
      session.lastActivity = new Date();
      
      // Добавляем в историю
      session.history.push(`INPUT: ${message.data}`);
      this.trimHistory(session);

      logger.debug('Terminal input processed', {
        sessionId: session.id,
        inputLength: message.data.length
      });

    } catch (error) {
      logger.error('Error processing terminal input', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendErrorMessage(connection, 'Failed to process terminal input', 'INPUT_ERROR');
    }
  }

  public async handleCommand(connection: WebSocketConnection, message: TerminalCommand): Promise<void> {
    const session = this.getOrCreateSession(connection);
    
    if (!session) {
      this.sendErrorMessage(connection, 'Failed to create terminal session', 'SESSION_ERROR');
      return;
    }

    try {
      logger.info('Executing terminal command', {
        sessionId: session.id,
        command: message.command
      });

      // Отправляем команду в терминал
      session.process.write(message.command + '\n');
      session.lastActivity = new Date();
      
      // Добавляем в историю
      session.history.push(`COMMAND: ${message.command}`);
      this.trimHistory(session);

    } catch (error) {
      logger.error('Error executing terminal command', {
        sessionId: session.id,
        command: message.command,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendErrorMessage(connection, 'Failed to execute command', 'COMMAND_ERROR');
    }
  }

  public closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      logger.info('Closing terminal session', { sessionId });
      
      session.isActive = false;
      session.process.kill();
      this.sessions.delete(sessionId);
      
      // Отправляем статус закрытия
      this.sendStatusMessage(session.connection, 'stopped', sessionId);
    }
  }

  private getOrCreateSession(connection: WebSocketConnection): TerminalSession | null {
    const sessionId = connection.sessionId;
    if (!sessionId) {
      return null;
    }

    // Проверяем существующую сессию
    let session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      return session;
    }

    // Создаем новую сессию
    try {
      const ptyProcess = spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: config.workspaceDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });

      session = {
        id: sessionId,
        process: ptyProcess,
        connection,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true,
        workingDirectory: config.workspaceDir,
        history: []
      };

      // Настраиваем обработчики событий терминала
      ptyProcess.onData((data) => {
        this.handleTerminalOutput(session!, data);
      });

      ptyProcess.onExit((exitCode) => {
        this.handleTerminalExit(session!, typeof exitCode === 'number' ? exitCode : exitCode.exitCode);
      });

      this.sessions.set(sessionId, session);
      
      logger.info('Created new terminal session', {
        sessionId,
        pid: ptyProcess.pid,
        workingDirectory: config.workspaceDir
      });

      // Отправляем статус запуска
      this.sendStatusMessage(connection, 'started', sessionId, ptyProcess.pid);

      return session;

    } catch (error) {
      logger.error('Failed to create terminal session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }

  private handleTerminalOutput(session: TerminalSession, data: string): void {
    // Отправляем вывод клиенту
    const outputMessage: TerminalOutput = {
      type: 'terminal_output',
      data,
      sessionId: session.id,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    this.sendMessage(session.connection, outputMessage);
    
    // Добавляем в историю
    session.history.push(`OUTPUT: ${data}`);
    this.trimHistory(session);
    
    session.lastActivity = new Date();

    logger.debug('Terminal output sent', {
      sessionId: session.id,
      outputLength: data.length
    });
  }

  private handleTerminalExit(session: TerminalSession, exitCode: number): void {
    logger.info('Terminal session exited', {
      sessionId: session.id,
      exitCode
    });

    session.isActive = false;
    this.sessions.delete(session.id);
    
    // Отправляем статус завершения
    this.sendStatusMessage(session.connection, 'stopped', session.id);
  }

  private sendMessage(connection: WebSocketConnection, message: TerminalOutput): void {
    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
    }
  }

  private sendStatusMessage(
    connection: WebSocketConnection, 
    status: 'started' | 'stopped' | 'error', 
    sessionId: string, 
    pid?: number
  ): void {
    const statusMessage: TerminalStatus = {
      type: 'terminal_status',
      status,
      sessionId,
      pid,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(statusMessage));
    }
  }

  private sendErrorMessage(connection: WebSocketConnection, message: string, code: string): void {
    const errorMessage = {
      type: 'terminal_error',
      error: message,
      code,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(errorMessage));
    }
  }

  private trimHistory(session: TerminalSession): void {
    if (session.history.length > this.maxHistoryLength) {
      session.history = session.history.slice(-this.maxHistoryLength);
    }
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30 минут

    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive || (now.getTime() - session.lastActivity.getTime()) > inactiveThreshold) {
        logger.info('Cleaning up inactive terminal session', { sessionId });
        this.closeSession(sessionId);
      }
    }
  }

  // Получение статистики сессий
  public getSessionStats(): {
    total: number;
    active: number;
    sessions: Array<{
      id: string;
      startTime: Date;
      lastActivity: Date;
      isActive: boolean;
      workingDirectory: string;
      historyLength: number;
    }>;
  } {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      isActive: session.isActive,
      workingDirectory: session.workingDirectory,
      historyLength: session.history.length
    }));

    return {
      total: this.sessions.size,
      active: sessions.filter(s => s.isActive).length,
      sessions
    };
  }

  // Очистка всех сессий
  public cleanup(): void {
    logger.info('Cleaning up all terminal sessions');
    
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        session.process.kill();
      }
    }
    
    this.sessions.clear();
  }
} 