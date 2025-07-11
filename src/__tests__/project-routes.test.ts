import request from 'supertest';
import express from 'express';
import { setupProjectRoutes } from '../routes/project-routes';
import { ProjectService } from '../services/project-service';
import { CreateProjectRequest, Project } from '../types/project';

// Mock ProjectService
jest.mock('../services/project-service');

describe('Project Routes', () => {
  let app: express.Application;
  let mockProjectService: jest.Mocked<ProjectService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockProjectService = {
      createProject: jest.fn(),
      listProjects: jest.fn(),
      getProject: jest.fn(),
      activateProject: jest.fn(),
      deleteProject: jest.fn(),
      getProjectStats: jest.fn(),
      getActiveProject: jest.fn(),
      getProjectsDirectory: jest.fn(),
    } as unknown as jest.Mocked<ProjectService>;

    app.use('/api/projects', setupProjectRoutes(mockProjectService));
  });

  describe('GET /api/projects', () => {
    it('должен вернуть список проектов', async () => {
      const mockProjects = [
        {
          id: '1',
          name: 'Project 1',
          path: '/path/to/project1',
          type: 'local',
          createdAt: new Date(),
          lastAccessed: new Date(),
          isActive: true
        } as Project
      ];

      mockProjectService.listProjects.mockResolvedValue({
        projects: mockProjects,
        activeProject: mockProjects[0]
      });

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body.projects).toHaveLength(1);
      expect(response.body.activeProject).toEqual(expect.objectContaining({
        id: '1',
        name: 'Project 1'
      }));
    });

    it('должен обработать ошибку при получении проектов', async () => {
      mockProjectService.listProjects.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/projects')
        .expect(500);

      expect(response.body.error).toBe('Ошибка получения списка проектов');
    });
  });

  describe('GET /api/projects/stats', () => {
    it('должен вернуть статистику проектов', async () => {
      const mockStats = {
        totalProjects: 5,
        gitProjects: 3,
        localProjects: 2,
        activeProject: 'project-1'
      };

      mockProjectService.getProjectStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/projects/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('должен вернуть проект по ID', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        path: '/path/to/test',
        type: 'local',
        createdAt: new Date(),
        lastAccessed: new Date(),
        isActive: false
      } as Project;

      mockProjectService.getProject.mockResolvedValue(mockProject);

      const response = await request(app)
        .get('/api/projects/1')
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining({
        id: '1',
        name: 'Test Project'
      }));
    });

    it('должен вернуть 404 для несуществующего проекта', async () => {
      mockProjectService.getProject.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/projects/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Проект не найден');
    });
  });

  describe('POST /api/projects', () => {
    it('должен создать локальный проект', async () => {
      const createRequest: CreateProjectRequest = {
        name: 'New Project',
        type: 'local',
        description: 'A new local project'
      };

      const mockCreatedProject = {
        id: '1',
        name: 'New Project',
        path: '/path/to/new',
        type: 'local',
        description: 'A new local project',
        createdAt: new Date(),
        lastAccessed: new Date(),
        isActive: false
      } as Project;

      mockProjectService.createProject.mockResolvedValue(mockCreatedProject);

      const response = await request(app)
        .post('/api/projects')
        .send(createRequest)
        .expect(201);

      expect(response.body).toEqual(expect.objectContaining({
        name: 'New Project',
        type: 'local'
      }));
    });

    it('должен создать Git проект', async () => {
      const createRequest: CreateProjectRequest = {
        name: 'Git Project',
        type: 'git',
        gitUrl: 'https://github.com/test/repo.git',
        branch: 'main'
      };

      const mockCreatedProject = {
        id: '1',
        name: 'Git Project',
        path: '/path/to/git',
        type: 'git',
        gitUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        createdAt: new Date(),
        lastAccessed: new Date(),
        isActive: false
      } as Project;

      mockProjectService.createProject.mockResolvedValue(mockCreatedProject);

      const response = await request(app)
        .post('/api/projects')
        .send(createRequest)
        .expect(201);

      expect(response.body).toEqual(expect.objectContaining({
        name: 'Git Project',
        type: 'git',
        gitUrl: 'https://github.com/test/repo.git'
      }));
    });

    it('должен вернуть ошибку валидации при отсутствии имени', async () => {
      const createRequest = {
        type: 'local'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(createRequest)
        .expect(400);

      expect(response.body.error).toBe('Имя и тип проекта обязательны');
    });

    it('должен вернуть ошибку валидации для Git проекта без URL', async () => {
      const createRequest = {
        name: 'Invalid Git Project',
        type: 'git'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(createRequest)
        .expect(400);

      expect(response.body.error).toBe('Git URL обязателен для Git проектов');
    });

    it('должен обработать ошибку создания проекта', async () => {
      const createRequest: CreateProjectRequest = {
        name: 'Error Project',
        type: 'local'
      };

      mockProjectService.createProject.mockRejectedValue(new Error('Creation failed'));

      const response = await request(app)
        .post('/api/projects')
        .send(createRequest)
        .expect(500);

      expect(response.body.error).toBe('Ошибка создания проекта: Creation failed');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('должен удалить проект', async () => {
      mockProjectService.deleteProject.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/projects/1')
        .expect(200);

      expect(response.body.message).toBe('Проект успешно удален');
    });

    it('должен вернуть 404 для несуществующего проекта', async () => {
      mockProjectService.deleteProject.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/projects/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Проект не найден');
    });

    it('должен обработать ошибку удаления проекта', async () => {
      mockProjectService.deleteProject.mockRejectedValue(new Error('Deletion failed'));

      const response = await request(app)
        .delete('/api/projects/1')
        .expect(500);

      expect(response.body.error).toBe('Ошибка удаления проекта: Deletion failed');
    });
  });
}); 