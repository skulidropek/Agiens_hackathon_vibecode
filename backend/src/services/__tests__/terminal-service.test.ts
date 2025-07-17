import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TerminalService, CreateTerminalRequest, TerminalSession } from '../terminal-service';
import { AppConfig, loadConfig } from '../../config/app-config';
import { ProjectService } from '../project-service';

jest.mock('node-pty', () => ({
  spawn: jest.fn().mockImplementation(() => ({
    pid: 1234,
    kill: jest.fn(),
    onData: jest.fn(),
    onExit: jest.fn(),
    write: jest.fn(),
    resize: jest.fn(),
  })),
}));

describe('TerminalService', () => {
  let terminalService: TerminalService;
  let config: AppConfig;
  let projectService: ProjectService;
  const mockPty = require('node-pty');

  beforeEach(() => {
    config = loadConfig();
    projectService = new ProjectService(config.workspaceDir);
    
    // Mock getProject to return a fake project
    jest.spyOn(projectService, 'getProject').mockResolvedValue({
      id: 'test-project',
      name: 'test-project',
      path: '/tmp/test-project',
      type: 'local',
      createdAt: new Date(),
      lastAccessed: new Date(),
    });
    
    terminalService = new TerminalService(config, projectService);
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should throw an error if projectId is missing', async () => {
      const request = { command: 'ls' } as Omit<CreateTerminalRequest, 'projectId'>;
      await expect(terminalService.createSession(request as CreateTerminalRequest)).rejects.toThrow(
        'ProjectId is required - all terminals must be attached to a project'
      );
    });

    it('should throw an error if projectId is an empty string', async () => {
      const request: CreateTerminalRequest = { command: 'ls', projectId: '   ' };
      await expect(terminalService.createSession(request)).rejects.toThrow(
        'ProjectId is required - all terminals must be attached to a project'
      );
    });

    it('should create a session successfully with a valid projectId', async () => {
      const request: CreateTerminalRequest = { command: 'ls', projectId: 'test-project' };
      const session = await terminalService.createSession(request);

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.command).toBe('ls');
      expect(mockPty.spawn).toHaveBeenCalledTimes(1);
      expect(terminalService.getAllSessions().length).toBe(1);
    });

    it('should use the project-specific working directory', async () => {
        const request: CreateTerminalRequest = { projectId: 'test-project' };
        await terminalService.createSession(request);
        const expectedCwd = '/tmp/test-project'; // From our mocked project
        expect(mockPty.spawn).toHaveBeenCalledWith(
            'bash', [], expect.objectContaining({ cwd: expectedCwd })
        );
    });
  });

  describe('cleanup', () => {
    it('should kill all active terminal sessions', async () => {
      const session1 = await terminalService.createSession({ projectId: 'proj1', command: 'sleep 10' });
      const session2 = await terminalService.createSession({ projectId: 'proj2', command: 'sleep 10' });

      // Manually set sessions to active for testing purposes
      (session1 as TerminalSession).isActive = true;
      (session2 as TerminalSession).isActive = true;
      
      const activeSessions = terminalService.getActiveSessions();
      expect(activeSessions.length).toBe(2);

      terminalService.cleanup();
      
      expect(session1.process.kill).toHaveBeenCalled();
      expect(session2.process.kill).toHaveBeenCalled();
      expect(terminalService.getAllSessions().length).toBe(0);
    });
  });
  
  describe('getSession', () => {
    it('should return a session by its ID', async () => {
      const session = await terminalService.createSession({ projectId: 'test-project' });
      const foundSession = terminalService.getSession(session.id);
      expect(foundSession).toBeDefined();
      expect(foundSession?.id).toBe(session.id);
    });
  });

  describe('getSessionsByProject', () => {
    it('should return all sessions for a given projectId', async () => {
      await terminalService.createSession({ projectId: 'project-a' });
      await terminalService.createSession({ projectId: 'project-b' });
      await terminalService.createSession({ projectId: 'project-a' });

      const projectASessions = terminalService.getSessionsByProject('project-a');
      expect(projectASessions.length).toBe(2);
      
      const projectBSessions = terminalService.getSessionsByProject('project-b');
      expect(projectBSessions.length).toBe(1);
    });
  });
}); 