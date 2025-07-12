import { Router, Request, Response } from 'express';
import { ProjectService } from '../services/project-service';
import { CreateProjectRequest } from '../types/project';
import { logger } from '../utils/logger';

let projectService: ProjectService;

export function setupProjectRoutes(projectServiceInstance: ProjectService): Router {
  projectService = projectServiceInstance;
  const router = Router();

  /**
   * @openapi
   * /api/projects:
   *   get:
   *     summary: Получить список всех проектов
   *     tags:
   *       - Projects
   *     responses:
   *       200:
   *         description: Список проектов
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 projects:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Project'
   *                 activeProject:
   *                   $ref: '#/components/schemas/Project'
   */
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

  /**
   * @openapi
   * /api/projects/stats:
   *   get:
   *     summary: Получить статистику проектов
   *     tags:
   *       - Projects
   *     responses:
   *       200:
   *         description: Статистика проектов
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalProjects:
   *                   type: integer
   *                 gitProjects:
   *                   type: integer
   *                 localProjects:
   *                   type: integer
   *                 activeProject:
   *                   type: string
   */
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

  /**
   * @openapi
   * /api/projects/{id}:
   *   get:
   *     summary: Получить проект по ID
   *     tags:
   *       - Projects
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     responses:
   *       200:
   *         description: Проект
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Project'
   *       404:
   *         description: Проект не найден
   */
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

  /**
   * @openapi
   * /api/projects:
   *   post:
   *     summary: Создать новый проект
   *     tags:
   *       - Projects
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateProjectRequest'
   *     responses:
   *       201:
   *         description: Проект создан
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Project'
   *       400:
   *         description: Ошибка валидации
   */
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

  /**
   * @openapi
   * /api/projects/{id}:
   *   delete:
   *     summary: Удалить проект
   *     tags:
   *       - Projects
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID проекта
   *     responses:
   *       200:
   *         description: Проект успешно удален
   *       404:
   *         description: Проект не найден
   */
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