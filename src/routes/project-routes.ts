import { Router, Request, Response } from 'express';
import { ProjectService } from '../services/project-service';
import { CreateProjectRequest } from '../types/project';
import { logger } from '../utils/logger';

let projectService: ProjectService;

export function setupProjectRoutes(projectServiceInstance: ProjectService): Router {
  projectService = projectServiceInstance;
  const router = Router();

  // GET /api/projects - Получить список всех проектов
  router.get('/', async (req: Request, res: Response) => {
    try {
      const projectList = await projectService.listProjects();
      res.json(projectList);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка получения списка проектов:', errorMessage);
      res.status(500).json({ error: 'Ошибка получения списка проектов' });
    }
  });

  // GET /api/projects/stats - Получить статистику проектов
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await projectService.getProjectStats();
      res.json(stats);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка получения статистики проектов:', errorMessage);
      res.status(500).json({ error: 'Ошибка получения статистики проектов' });
    }
  });

  // GET /api/projects/:id - Получить конкретный проект
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const project = await projectService.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Проект не найден' });
      }
      res.json(project);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка получения проекта:', errorMessage);
      res.status(500).json({ error: 'Ошибка получения проекта' });
    }
  });

  // POST /api/projects - Создать новый проект
  router.post('/', async (req: Request, res: Response) => {
    try {
      const createRequest: CreateProjectRequest = req.body;
      
      // Валидация
      if (!createRequest.name || !createRequest.type) {
        return res.status(400).json({ 
          error: 'Имя и тип проекта обязательны' 
        });
      }

      if (createRequest.type === 'git' && !createRequest.gitUrl) {
        return res.status(400).json({ 
          error: 'Git URL обязателен для Git проектов' 
        });
      }

      const project = await projectService.createProject(createRequest);
      res.status(201).json(project);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка создания проекта:', errorMessage);
      res.status(500).json({ error: 'Ошибка создания проекта: ' + errorMessage });
    }
  });

  // DELETE /api/projects/:id - Удалить проект
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await projectService.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Проект не найден' });
      }
      res.json({ message: 'Проект успешно удален' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка удаления проекта:', errorMessage);
      res.status(500).json({ error: 'Ошибка удаления проекта: ' + errorMessage });
    }
  });

  return router;
} 