import { spawn, IPty } from 'node-pty';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { AppConfig } from '../config/app-config';
import path from 'path';

export interface TerminalSession {
  id: string;
  process: IPty;
  projectId: string; // Required - every terminal belongs to a project
  command: string;
  cwd: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  pid: number;
  exitCode?: number;
  history: TerminalHistoryEntry[];
}

export interface TerminalHistoryEntry {
  type: 'input' | 'output' | 'command' | 'exit';
  data: string;
  timestamp: Date;
}

export interface CreateTerminalRequest {
  command?: string;
  args?: string[];
  cwd?: string;
  projectId: string; // Required - terminal must be attached to a project
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  sessions: Array<{
    id: string;
    command: string;
    projectId: string; // Required - every terminal belongs to a project
    startTime: Date;
    lastActivity: Date;
    isActive: boolean;
    pid: number;
    exitCode?: number;
  }>;
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private config: AppConfig;
  private readonly maxHistoryLength = 1000;
  private readonly sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes

  constructor(config: AppConfig) {
    this.config = config;
    
    // Cleanup inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new terminal session
   */
  public async createSession(request: CreateTerminalRequest): Promise<TerminalSession> {
    // Validate that projectId is provided
    if (!request.projectId || request.projectId.trim() === '') {
      throw new Error('ProjectId is required - all terminals must be attached to a project');
    }

    const sessionId = uuidv4();
    const {
      command = 'bash',
      args = [],
      cwd = request.cwd || this.getProjectWorkingDirectory(request.projectId),
      env = {},
      cols = 80,
      rows = 24
    } = request;

    try {
      const ptyProcess = spawn(command, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          ...env
        }
      });

      const session: TerminalSession = {
        id: sessionId,
        process: ptyProcess,
        projectId: request.projectId,
        command: `${command} ${args.join(' ')}`.trim(),
        cwd,
        startTime: new Date(),
        lastActivity: new Date(),
        isActive: true,
        pid: ptyProcess.pid,
        history: []
      };

      // Setup PTY event handlers
      this.setupPtyEventHandlers(session);

      this.sessions.set(sessionId, session);

      logger.info('Terminal session created', {
        sessionId,
        command: session.command,
        projectId: request.projectId,
        pid: ptyProcess.pid,
        cwd
      });

      return session;

    } catch (error) {
      logger.error('Failed to create terminal session', {
        sessionId,
        command,
        args,
        cwd,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to create terminal session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get terminal session by ID
   */
  public getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all terminal sessions
   */
  public getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active terminal sessions
   */
  public getActiveSessions(): TerminalSession[] {
    return this.getAllSessions().filter(session => session.isActive);
  }

  /**
   * Get sessions by project ID
   */
  public getSessionsByProject(projectId: string): TerminalSession[] {
    return this.getAllSessions().filter(session => session.projectId === projectId);
  }

  /**
   * Write data to terminal session
   */
  public writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      session.process.write(data);
      session.lastActivity = new Date();
      
      this.addToHistory(session, {
        type: 'input',
        data,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      logger.error('Failed to write to terminal session', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Resize terminal session
   */
  public resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    try {
      session.process.resize(cols, rows);
      session.lastActivity = new Date();
      
      logger.debug('Terminal session resized', {
        sessionId,
        cols,
        rows
      });

      return true;
    } catch (error) {
      logger.error('Failed to resize terminal session', {
        sessionId,
        cols,
        rows,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Kill terminal session
   */
  public killSession(sessionId: string, signal?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.process.kill(signal);
      session.isActive = false;
      
      logger.info('Terminal session killed', {
        sessionId,
        signal: signal || 'SIGTERM',
        pid: session.pid
      });

      // Don't delete immediately, allow for cleanup
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 5000);

      return true;
    } catch (error) {
      logger.error('Failed to kill terminal session', {
        sessionId,
        signal,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get terminal session statistics
   */
  public getStats(): TerminalStats {
    const allSessions = this.getAllSessions();
    const activeSessions = allSessions.filter(s => s.isActive);
    const completedSessions = allSessions.filter(s => !s.isActive);

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      completedSessions: completedSessions.length,
      sessions: allSessions.map(session => ({
        id: session.id,
        command: session.command,
        projectId: session.projectId,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        pid: session.pid,
        exitCode: session.exitCode
      }))
    };
  }

  /**
   * Cleanup all sessions
   */
  public cleanup(): void {
    logger.info('Cleaning up all terminal sessions');
    
    for (const session of this.sessions.values()) {
      if (session.isActive) {
        session.process.kill();
      }
    }
    
    this.sessions.clear();
  }

  /**
   * Register event handlers for terminal events
   */
  public onSessionOutput?: (sessionId: string, data: string) => void;
  public onSessionExit?: (sessionId: string, exitCode: number) => void;
  public onSessionError?: (sessionId: string, error: string) => void;

  /**
   * Setup PTY event handlers for a session
   */
  private setupPtyEventHandlers(session: TerminalSession): void {
    session.process.onData((data) => {
      session.lastActivity = new Date();
      
      this.addToHistory(session, {
        type: 'output',
        data,
        timestamp: new Date()
      });

      if (this.onSessionOutput) {
        this.onSessionOutput(session.id, data);
      }

      logger.debug('Terminal output', {
        sessionId: session.id,
        dataLength: data.length
      });
    });

    session.process.onExit((exitCode) => {
      session.isActive = false;
      session.exitCode = typeof exitCode === 'number' ? exitCode : exitCode.exitCode;
      
      this.addToHistory(session, {
        type: 'exit',
        data: `Process exited with code ${session.exitCode}`,
        timestamp: new Date()
      });

      if (this.onSessionExit) {
        this.onSessionExit(session.id, session.exitCode);
      }

      logger.info('Terminal session exited', {
        sessionId: session.id,
        exitCode: session.exitCode,
        pid: session.pid
      });
    });
  }

  /**
   * Add entry to session history
   */
  private addToHistory(session: TerminalSession, entry: TerminalHistoryEntry): void {
    session.history.push(entry);
    
    if (session.history.length > this.maxHistoryLength) {
      session.history = session.history.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get project working directory
   */
  private getProjectWorkingDirectory(_projectId: string): string {
    // This should ideally use ProjectService to get the actual project path
    const projectPath = path.join(this.config.workspaceDir, _projectId);
    // Basic security check to prevent path traversal
    if (!path.resolve(projectPath).startsWith(path.resolve(this.config.workspaceDir))) {
        throw new Error(`Invalid projectId leading to path traversal: ${_projectId}`);
    }
    return projectPath;
  }

  /**
   * Cleanup inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    
    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      if (!session.isActive || timeSinceLastActivity > this.sessionTimeoutMs) {
        logger.info('Cleaning up inactive terminal session', {
          sessionId,
          timeSinceLastActivity,
          isActive: session.isActive
        });
        
        if (session.isActive) {
          session.process.kill();
        }
        
        this.sessions.delete(sessionId);
      }
    }
  }
} 