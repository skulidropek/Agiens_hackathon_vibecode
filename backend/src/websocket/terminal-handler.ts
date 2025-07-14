import { WebSocketConnection, TerminalInput, TerminalCommand, TerminalOutput, TerminalStatus } from '../types';
import { logger } from '../utils/logger';
import { TerminalService } from '../services/terminal-service';
import { v4 as uuidv4 } from 'uuid';

export class TerminalHandler {
  private terminalService: TerminalService;
  private connections = new Map<string, Set<WebSocketConnection>>();

  constructor(terminalService: TerminalService) {
    this.terminalService = terminalService;
    
    // Setup terminal service event handlers
    this.terminalService.onSessionOutput = (sessionId: string, data: string) => {
      this.broadcastOutput(sessionId, data);
    };
    
    this.terminalService.onSessionExit = (sessionId: string, exitCode: number) => {
      this.broadcastExit(sessionId, exitCode);
    };
    
    this.terminalService.onSessionError = (sessionId: string, error: string) => {
      this.broadcastError(sessionId, error);
    };
  }

  /**
   * Handle terminal input from WebSocket
   */
  public async handleInput(connection: WebSocketConnection, message: TerminalInput): Promise<void> {
    try {
      const { sessionId, data } = message;
      
      if (!sessionId) {
        this.sendErrorMessage(connection, 'Session ID is required', 'MISSING_SESSION_ID');
        return;
      }

      const success = this.terminalService.writeToSession(sessionId, data);
      if (!success) {
        this.sendErrorMessage(connection, 'Failed to write to terminal session', 'WRITE_FAILED');
        return;
      }

      // Add connection to session subscribers if not already added
      this.addConnectionToSession(sessionId, connection);

      logger.debug('Terminal input processed', {
        sessionId,
        connectionId: connection.id,
        inputLength: data.length
      });

    } catch (error) {
      logger.error('Error processing terminal input', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendErrorMessage(connection, 'Failed to process terminal input', 'INPUT_ERROR');
    }
  }

  /**
   * Handle terminal command from WebSocket
   */
  public async handleCommand(connection: WebSocketConnection, message: TerminalCommand): Promise<void> {
    try {
      const { sessionId, command } = message;
      
      if (!sessionId) {
        this.sendErrorMessage(connection, 'Session ID is required', 'MISSING_SESSION_ID');
        return;
      }

      logger.info('Executing terminal command', {
        sessionId,
        connectionId: connection.id,
        command
      });

      const success = this.terminalService.writeToSession(sessionId, command + '\n');
      if (!success) {
        this.sendErrorMessage(connection, 'Failed to execute command', 'COMMAND_FAILED');
        return;
      }

      // Add connection to session subscribers if not already added
      this.addConnectionToSession(sessionId, connection);

    } catch (error) {
      logger.error('Error executing terminal command', {
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendErrorMessage(connection, 'Failed to execute command', 'COMMAND_ERROR');
    }
  }

  /**
   * Handle terminal resize from WebSocket
   */
  public async handleResize(connection: WebSocketConnection, sessionId: string, cols: number, rows: number): Promise<void> {
    try {
      if (!sessionId) {
        this.sendErrorMessage(connection, 'Session ID is required', 'MISSING_SESSION_ID');
        return;
      }

      const success = this.terminalService.resizeSession(sessionId, cols, rows);
      if (!success) {
        this.sendErrorMessage(connection, 'Failed to resize terminal', 'RESIZE_FAILED');
        return;
      }

      logger.debug('Terminal resized', {
        sessionId,
        connectionId: connection.id,
        cols,
        rows
      });

    } catch (error) {
      logger.error('Error resizing terminal', {
        connectionId: connection.id,
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.sendErrorMessage(connection, 'Failed to resize terminal', 'RESIZE_ERROR');
    }
  }

  /**
   * Subscribe connection to terminal session
   */
  public subscribeToSession(sessionId: string, connection: WebSocketConnection): void {
    this.addConnectionToSession(sessionId, connection);
    
    // Send current session status
    const session = this.terminalService.getSession(sessionId);
    if (session) {
      this.sendStatusMessage(connection, session.isActive ? 'active' : 'stopped', sessionId, session.pid);
    } else {
      this.sendErrorMessage(connection, 'Terminal session not found', 'SESSION_NOT_FOUND');
    }
  }

  /**
   * Unsubscribe connection from terminal session
   */
  public unsubscribeFromSession(sessionId: string, connection: WebSocketConnection): void {
    const connections = this.connections.get(sessionId);
    if (connections) {
      connections.delete(connection);
      
      if (connections.size === 0) {
        this.connections.delete(sessionId);
      }
    }
  }

  /**
   * Close session when connection closes
   */
  public handleConnectionClose(connection: WebSocketConnection): void {
    // Remove connection from all sessions
    for (const [sessionId, connections] of this.connections) {
      connections.delete(connection);
      
      if (connections.size === 0) {
        this.connections.delete(sessionId);
        
        // Optionally kill session when no connections are left
        // this.terminalService.killSession(sessionId);
      }
    }
  }

  /**
   * Get session statistics
   */
  public getSessionStats() {
    return this.terminalService.getStats();
  }

  /**
   * Cleanup all sessions
   */
  public cleanup(): void {
    this.connections.clear();
    this.terminalService.cleanup();
  }

  /**
   * Add connection to session subscribers
   */
  private addConnectionToSession(sessionId: string, connection: WebSocketConnection): void {
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    
    this.connections.get(sessionId)!.add(connection);
  }

  /**
   * Broadcast terminal output to all subscribers
   */
  private broadcastOutput(sessionId: string, data: string): void {
    const connections = this.connections.get(sessionId);
    if (!connections) return;

    const outputMessage: TerminalOutput = {
      type: 'terminal_output',
      data,
      sessionId,
      timestamp: new Date().toISOString(),
      id: uuidv4()
    };

    for (const connection of connections) {
      this.sendMessage(connection, outputMessage);
    }

    logger.debug('Terminal output broadcasted', {
      sessionId,
      connectionCount: connections.size,
      dataLength: data.length
    });
  }

  /**
   * Broadcast terminal exit to all subscribers
   */
  private broadcastExit(sessionId: string, exitCode: number): void {
    const connections = this.connections.get(sessionId);
    if (!connections) return;

    for (const connection of connections) {
      this.sendStatusMessage(connection, 'stopped', sessionId);
    }

    // Clean up connections for this session
    this.connections.delete(sessionId);

    logger.info('Terminal exit broadcasted', {
      sessionId,
      exitCode,
      connectionCount: connections.size
    });
  }

  /**
   * Broadcast terminal error to all subscribers
   */
  private broadcastError(sessionId: string, error: string): void {
    const connections = this.connections.get(sessionId);
    if (!connections) return;

    for (const connection of connections) {
      this.sendErrorMessage(connection, error, 'TERMINAL_ERROR');
    }

    logger.error('Terminal error broadcasted', {
      sessionId,
      error,
      connectionCount: connections.size
    });
  }

  /**
   * Send message to WebSocket connection
   */
  private sendMessage(connection: WebSocketConnection, message: TerminalOutput): void {
    if (connection.ws.readyState === 1) { // WebSocket.OPEN
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send status message to WebSocket connection
   */
  private sendStatusMessage(
    connection: WebSocketConnection, 
    status: 'active' | 'stopped' | 'error', 
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

  /**
   * Send error message to WebSocket connection
   */
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
} 