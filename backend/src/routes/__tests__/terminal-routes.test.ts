import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { setupTerminalRoutes } from '../../routes/terminal-routes';
import { TerminalService, TerminalSession } from '../../services/terminal-service';
import { loadConfig } from '../../config/app-config';
import { errorHandler } from '../../middleware/error-handler';

// Mock TerminalService
jest.mock('../../services/terminal-service');

describe('Terminal Routes', () => {
  let app: express.Application;
  let terminalService: jest.Mocked<TerminalService>;

  beforeEach(() => {
    const config = loadConfig();
    terminalService = new TerminalService(config) as jest.Mocked<TerminalService>;

    app = express();
    app.use(express.json());
    app.use('/api/terminals', setupTerminalRoutes(terminalService));
    app.use(errorHandler); // Use a generic error handler for testing
  });

  describe('POST /api/terminals', () => {
    it('should return 400 if projectId is missing', async () => {
        // Mock the implementation for this specific test
        terminalService.createSession.mockImplementation(async () => {
            throw new Error('ProjectId is required');
        });

      const response = await request(app)
        .post('/api/terminals')
        .send({ command: 'ls' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('projectId is required');
    });

    it('should return 201 and the session object on successful creation', async () => {
        const mockSession: Partial<TerminalSession> = {
            id: 'mock-id',
            command: 'ls',
            projectId: 'test-project',
            isActive: true,
            pid: 12345,
        };
        terminalService.createSession.mockResolvedValue(mockSession as TerminalSession);

      const response = await request(app)
        .post('/api/terminals')
        .send({ command: 'ls', projectId: 'test-project' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('mock-id');
      expect(response.body.data.projectId).toBe('test-project');
    });
  });

  describe('GET /api/terminals', () => {
    it('should return a list of all terminal sessions', async () => {
        const mockSessions: Partial<TerminalSession>[] = [
            { id: 'id1', projectId: 'proj1', command: 'cmd1', isActive: false, pid: 1 },
            { id: 'id2', projectId: 'proj2', command: 'cmd2', isActive: true, pid: 2 },
        ];
        terminalService.getAllSessions.mockReturnValue(mockSessions as TerminalSession[]);

      const response = await request(app).get('/api/terminals');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[1].projectId).toBe('proj2');
    });
  });

  describe('GET /api/terminals?projectId=:projectId', () => {
    it('should return a filtered list of sessions for a project', async () => {
        const mockSessions = [
            { id: 'id1', projectId: 'proj1', command: 'cmd1', isActive: false, pid: 1 },
            { id: 'id2', projectId: 'proj2', command: 'cmd2', isActive: true, pid: 2 },
            { id: 'id3', projectId: 'proj1', command: 'cmd3', isActive: true, pid: 3 },
        ];
        terminalService.getAllSessions.mockReturnValue(mockSessions as TerminalSession[]);

        const response = await request(app).get('/api/terminals?projectId=proj1');
        
        expect(response.status).toBe(200);
        expect(terminalService.getAllSessions).toHaveBeenCalled();
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].projectId).toBe('proj1');
        expect(response.body.data[1].projectId).toBe('proj1');
    });
  });
}); 