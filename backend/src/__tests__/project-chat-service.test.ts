import { ProjectChatService } from '../services/project-chat-service';
import { ProjectService } from '../services/project-service';
import { Project } from '../types/project';

describe('ProjectChatService', () => {
  let projectChatService: ProjectChatService;
  let mockProjectService: jest.Mocked<ProjectService>;

  beforeEach(() => {
    mockProjectService = {
      getProject: jest.fn(),
    } as unknown as jest.Mocked<ProjectService>;

    projectChatService = new ProjectChatService(mockProjectService);
  });

  describe('getAIContext', () => {
    it('должен вернуть контекст для проекта', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/path',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const context = await projectChatService.getAIContext('test-project-id');

      expect(context.projectId).toBe('test-project-id');
      expect(context.projectName).toBe('Test Project');
      expect(context.projectPath).toBe('/test/path');
      expect(context.currentDirectory).toBe('/test/path');
    });

    it('должен выбросить ошибку если проект не найден', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      await expect(projectChatService.getAIContext('nonexistent-id')).rejects.toThrow('Project not found');
    });
  });

  describe('getSecureProjectPath', () => {
    it('должен вернуть безопасный путь в рамках проекта', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/project',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const result = await projectChatService.getSecureProjectPath('test-project-id', 'src/index.js');
      expect(result).toBe('/test/project/src/index.js');
    });

    it('должен вернуть null если проект не найден', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      const result = await projectChatService.getSecureProjectPath('nonexistent-id', 'src/index.js');
      expect(result).toBeNull();
    });

    it('должен блокировать попытки выйти за пределы проекта', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/project',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const result = await projectChatService.getSecureProjectPath('test-project-id', '../../etc/passwd');
      expect(result).toBe('/test/project/etc/passwd');
    });
  });

  describe('isPathInActiveProject', () => {
    it('должен проверять принадлежность пути к проекту', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/project',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      expect(await projectChatService.isPathInActiveProject('test-project-id', '/test/project/src/index.js')).toBe(true);
      expect(await projectChatService.isPathInActiveProject('test-project-id', '/other/path/file.js')).toBe(false);
    });

    it('должен вернуть false если проект не найден', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      expect(await projectChatService.isPathInActiveProject('nonexistent-id', '/any/path')).toBe(false);
    });
  });

  describe('createProjectSession', () => {
    it('должен создать сессию для проекта', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/project',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const session = await projectChatService.createProjectSession('test-project-id', 'user123', 'conv456');

      expect(session).toBeDefined();
      expect(session?.projectId).toBe('test-project-id');
      expect(session?.userId).toBe('user123');
      expect(session?.conversationId).toBe('conv456');
      expect(session?.isActive).toBe(true);
    });

    it('должен вернуть null если проект не найден', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      const session = await projectChatService.createProjectSession('nonexistent-id', 'user123', 'conv456');

      expect(session).toBeNull();
    });
  });

  describe('getProjectStats', () => {
    it('должен вернуть статистику проекта', async () => {
      const mockProject: Project = {
        id: 'test-project-id',
        name: 'Test Project',
        path: '/test/project',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date()
      };

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const stats = await projectChatService.getProjectStats('test-project-id');

      expect(stats).toBeDefined();
      expect(stats.totalFiles).toBe(0); // Поскольку директория не существует
      expect(stats.totalSize).toBe(0);
      expect(stats.fileTypes).toEqual({});
    });

    it('должен вернуть пустую статистику если проект не найден', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      const stats = await projectChatService.getProjectStats('nonexistent-id');

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.fileTypes).toEqual({});
    });
  });
}); 