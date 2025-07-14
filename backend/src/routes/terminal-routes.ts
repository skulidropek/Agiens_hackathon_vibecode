import { Router, Request, Response } from 'express';
import { TerminalService, CreateTerminalRequest, TerminalStats, TerminalHistoryEntry } from '../services/terminal-service';
import { logger } from '../utils/logger';
import { 
  ValidationError, 
  NotFoundError 
} from '../middleware/error-handler';
import { ApiResponse } from '../types';

export function setupTerminalRoutes(terminalService: TerminalService): Router {
  const router = Router();

  /**
   * @openapi
   * /api/terminals:
   *   get:
   *     summary: Get all terminal sessions
   *     tags:
   *       - Terminals
   *     parameters:
   *       - in: query
   *         name: projectId
   *         schema:
   *           type: string
   *         description: Filter by project ID
   *       - in: query
   *         name: active
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *     responses:
   *       200:
   *         description: List of terminal sessions
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                 timestamp:
   *                   type: string
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { projectId, active } = req.query;
      
      let sessions = terminalService.getAllSessions();
      
      // Filter by project ID if provided
      if (projectId && typeof projectId === 'string') {
        sessions = sessions.filter(session => session.projectId === projectId);
      }
      
      // Filter by active status if provided
      if (active !== undefined) {
        const isActive = active === 'true';
        sessions = sessions.filter(session => session.isActive === isActive);
      }

      // Remove process object from response for security
      const safeSessions = sessions.map(session => ({
        id: session.id,
        command: session.command,
        projectId: session.projectId,
        cwd: session.cwd,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        pid: session.pid,
        exitCode: session.exitCode
      }));

      const response: ApiResponse<typeof safeSessions> = {
        success: true,
        data: safeSessions,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching terminal sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch terminal sessions',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @openapi
   * /api/terminals:
   *   post:
   *     summary: Create a new terminal session
   *     tags:
   *       - Terminals
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               command:
   *                 type: string
   *                 default: bash
   *               args:
   *                 type: array
   *                 items:
   *                   type: string
   *               cwd:
   *                 type: string
   *               projectId:
   *                 type: string
   *               env:
   *                 type: object
   *               cols:
   *                 type: integer
   *                 default: 80
   *               rows:
   *                 type: integer
   *                 default: 24
   *     responses:
   *       201:
   *         description: Terminal session created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 message:
   *                   type: string
   *                 timestamp:
   *                   type: string
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const createRequest: CreateTerminalRequest = req.body;
      
      // Validate request
      if (!createRequest.projectId || createRequest.projectId.trim() === '') {
        throw new ValidationError('projectId is required - all terminals must be attached to a project', 'projectId');
      }
      
      if (createRequest.cols && (createRequest.cols < 1 || createRequest.cols > 1000)) {
        throw new ValidationError('cols must be between 1 and 1000', 'cols');
      }
      
      if (createRequest.rows && (createRequest.rows < 1 || createRequest.rows > 1000)) {
        throw new ValidationError('rows must be between 1 and 1000', 'rows');
      }

      const session = await terminalService.createSession(createRequest);
      
      // Return safe session data
      const safeSession = {
        id: session.id,
        command: session.command,
        projectId: session.projectId,
        cwd: session.cwd,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        pid: session.pid
      };

      const response: ApiResponse<typeof safeSession> = {
        success: true,
        data: safeSession,
        message: 'Terminal session created successfully',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating terminal session', {
        error: error instanceof Error ? error.message : String(error),
        request: req.body
      });
      
      const statusCode = error instanceof ValidationError ? 400 : 500;
      const errorMessage = error instanceof Error ? error.message : 'Failed to create terminal session';
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @openapi
   * /api/terminals/{id}:
   *   get:
   *     summary: Get terminal session by ID
   *     tags:
   *       - Terminals
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Terminal session ID
   *       - in: query
   *         name: includeHistory
   *         schema:
   *           type: boolean
   *         description: Include session history
   *     responses:
   *       200:
   *         description: Terminal session details
   *       404:
   *         description: Session not found
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { includeHistory } = req.query;
      
      const session = terminalService.getSession(id);
      if (!session) {
        throw new NotFoundError('Terminal session', id);
      }

      interface SafeSessionWithHistory {
        id: string;
        command: string;
        projectId: string; // Required - every terminal belongs to a project
        cwd: string;
        startTime: Date;
        lastActivity: Date;
        isActive: boolean;
        pid: number;
        exitCode?: number;
        history?: TerminalHistoryEntry[];
      }

      const safeSession: SafeSessionWithHistory = {
        id: session.id,
        command: session.command,
        projectId: session.projectId,
        cwd: session.cwd,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: session.isActive,
        pid: session.pid,
        exitCode: session.exitCode
      };

      if (includeHistory === 'true') {
        safeSession.history = session.history;
      }

      const response: ApiResponse<typeof safeSession> = {
        success: true,
        data: safeSession,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.error('Error fetching terminal session', {
        sessionId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch terminal session',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @openapi
   * /api/terminals/{id}/resize:
   *   post:
   *     summary: Resize terminal session
   *     tags:
   *       - Terminals
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Terminal session ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - cols
   *               - rows
   *             properties:
   *               cols:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 1000
   *               rows:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 1000
   *     responses:
   *       200:
   *         description: Terminal resized successfully
   *       404:
   *         description: Session not found
   */
  router.post('/:id/resize', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { cols, rows } = req.body;
      
      if (!cols || !rows) {
        throw new ValidationError('cols and rows are required', 'resize');
      }
      
      if (cols < 1 || cols > 1000 || rows < 1 || rows > 1000) {
        throw new ValidationError('cols and rows must be between 1 and 1000', 'resize');
      }

      const success = terminalService.resizeSession(id, cols, rows);
      if (!success) {
        throw new NotFoundError('Terminal session or session not active', id);
      }

      res.json({
        success: true,
        message: 'Terminal resized successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const statusCode = error instanceof NotFoundError ? 404 : 
                        error instanceof ValidationError ? 400 : 500;
      const errorMessage = error instanceof Error ? error.message : 'Failed to resize terminal';
      
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @openapi
   * /api/terminals/{id}:
   *   delete:
   *     summary: Kill terminal session
   *     tags:
   *       - Terminals
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Terminal session ID
   *       - in: query
   *         name: signal
   *         schema:
   *           type: string
   *           default: SIGTERM
   *         description: Signal to send to process
   *     responses:
   *       200:
   *         description: Terminal killed successfully
   *       404:
   *         description: Session not found
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { signal } = req.query;
      
      const success = terminalService.killSession(id, signal as string);
      if (!success) {
        throw new NotFoundError('Terminal session', id);
      }

      res.json({
        success: true,
        message: 'Terminal session killed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.error('Error killing terminal session', {
        sessionId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to kill terminal session',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @openapi
   * /api/terminals/stats:
   *   get:
   *     summary: Get terminal sessions statistics
   *     tags:
   *       - Terminals
   *     responses:
   *       200:
   *         description: Terminal sessions statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                 timestamp:
   *                   type: string
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats: TerminalStats = terminalService.getStats();

      const response: ApiResponse<TerminalStats> = {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      logger.error('Error fetching terminal stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch terminal statistics',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
} 