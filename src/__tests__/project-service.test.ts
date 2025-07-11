import { ProjectService } from '../services/project-service';
import { CreateProjectRequest } from '../types/project';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Mock модулей
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    rm: jest.fn(),
  },
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('ProjectService', () => {
  let projectService: ProjectService;
  let mockWorkspaceDir: string;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;

  beforeEach(() => {
    mockWorkspaceDir = '/test/workspace';
    projectService = new ProjectService(mockWorkspaceDir);
    jest.clearAllMocks();
    mockUuid.mockReturnValue('test-uuid-123');
  });

  describe('createProject', () => {
    it('должен создать локальный проект', async () => {
      const request: CreateProjectRequest = {
        name: 'test-project',
        type: 'local',
        description: 'Test project'
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await projectService.createProject(request);

      expect(result).toEqual({
        id: 'test-uuid-123',
        name: 'test-project',
        path: join(mockWorkspaceDir, 'projects', 'test-project'),
        type: 'local',
        description: 'Test project',
        createdAt: expect.any(Date),
        lastAccessed: expect.any(Date),
        isActive: false,
        branch: 'main',
        gitUrl: undefined
      });

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        join(mockWorkspaceDir, 'projects', 'test-project'),
        { recursive: true }
      );
    });

    it('должен создать git проект', async () => {
      const request: CreateProjectRequest = {
        name: 'git-project',
        type: 'git',
        gitUrl: 'https://github.com/test/repo.git',
        branch: 'main'
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      // Mock git clone
      const mockSpawn = require('child_process').spawn;
      const mockChildProcess = {
        stderr: { on: jest.fn() },
        on: jest.fn((event, callback) => {
          if (event === 'close') {
            callback(0); // Success
          }
        })
      };
      mockSpawn.mockReturnValue(mockChildProcess);

      const result = await projectService.createProject(request);

      expect(result.type).toBe('git');
      expect(result.gitUrl).toBe('https://github.com/test/repo.git');
      expect(result.branch).toBe('main');
      expect(mockSpawn).toHaveBeenCalledWith('git', [
        'clone',
        '--branch',
        'main',
        'https://github.com/test/repo.git',
        join(mockWorkspaceDir, 'projects', 'git-project')
      ]);
    });

    it('должен выбросить ошибку для git проекта без URL', async () => {
      const request: CreateProjectRequest = {
        name: 'invalid-git-project',
        type: 'git'
      };

      await expect(projectService.createProject(request)).rejects.toThrow(
        'Git URL обязателен для Git проектов'
      );
    });
  });

  describe('listProjects', () => {
    it('должен вернуть список проектов', async () => {
      // Настроим мок для первого чтения файла (при инициализации)
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        activeProjectId: 'test-uuid-123',
        projects: [{
          id: 'test-uuid-123',
          name: 'test-project',
          path: '/test/path',
          type: 'local',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-01T00:00:00.000Z',
          isActive: true
        }]
      }));

      // Принудительно загрузим проекты
      await projectService['loadProjects']();

      const result = await projectService.listProjects();

      expect(result.projects).toHaveLength(1);
      expect(result.activeProject).toBeDefined();
      expect(result.activeProject?.name).toBe('test-project');
    });
  });

  describe('activateProject', () => {
    it('должен активировать проект', async () => {
      // Подготовка данных
      const projectId = 'test-uuid-123';
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProjectId: null,
        projects: [{
          id: projectId,
          name: 'test-project',
          path: '/test/path',
          type: 'local',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-01T00:00:00.000Z',
          isActive: false
        }]
      }));
      mockFs.writeFile.mockResolvedValue(undefined);

      // Загружаем проекты
      await projectService['loadProjects']();

      const result = await projectService.activateProject(projectId);

      expect(result.isActive).toBe(true);
      expect(result.lastAccessed).toBeInstanceOf(Date);
    });

    it('должен выбросить ошибку для несуществующего проекта', async () => {
      await expect(projectService.activateProject('nonexistent-id')).rejects.toThrow(
        'Проект с ID nonexistent-id не найден'
      );
    });
  });

  describe('deleteProject', () => {
    it('должен удалить проект', async () => {
      const projectId = 'test-uuid-123';
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProjectId: projectId,
        projects: [{
          id: projectId,
          name: 'test-project',
          path: '/test/path',
          type: 'local',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-01T00:00:00.000Z',
          isActive: true
        }]
      }));
      mockFs.rm.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      // Загружаем проекты
      await projectService['loadProjects']();

      const result = await projectService.deleteProject(projectId);

      expect(result).toBe(true);
      expect(mockFs.rm).toHaveBeenCalledWith('/test/path', { recursive: true, force: true });
    });

    it('должен вернуть false для несуществующего проекта', async () => {
      const result = await projectService.deleteProject('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('getProjectStats', () => {
    it('должен вернуть статистику проектов', async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        activeProjectId: 'test-uuid-123',
        projects: [
          {
            id: 'test-uuid-123',
            name: 'local-project',
            path: '/test/path1',
            type: 'local',
            createdAt: '2023-01-01T00:00:00.000Z',
            lastAccessed: '2023-01-01T00:00:00.000Z',
            isActive: true
          },
          {
            id: 'test-uuid-456',
            name: 'git-project',
            path: '/test/path2',
            type: 'git',
            createdAt: '2023-01-01T00:00:00.000Z',
            lastAccessed: '2023-01-01T00:00:00.000Z',
            isActive: false
          }
        ]
      }));

      // Загружаем проекты
      await projectService['loadProjects']();

      const result = await projectService.getProjectStats();

      expect(result).toEqual({
        totalProjects: 2,
        gitProjects: 1,
        localProjects: 1,
        activeProject: 'test-uuid-123'
      });
    });
  });
}); 