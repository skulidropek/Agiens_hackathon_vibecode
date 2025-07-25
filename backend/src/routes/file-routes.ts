import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { stat } from 'fs/promises';
import { AppConfig } from '../config/app-config';
import { logger } from '../utils/logger';
import { 
  ApiResponse, 
  FileInfo, 
  FileContent, 
  FileOperation 
} from '../types';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError, 
  ForbiddenError 
} from '../middleware/error-handler';
import { ProjectService } from '../services/project-service';

const config = new AppConfig();
const projectService = new ProjectService(config.workspaceDir);

export const setupFileRoutes = (): Router => {
  const router = Router();

  /**
 * @openapi
 * /api/files:
 *   get:
 *     summary: Получить список файлов в рабочей директории
 *     tags:
 *       - Files
 *     parameters:
 *       - in: query
 *         name: recursive
 *         schema:
 *           type: boolean
 *         description: Рекурсивно искать файлы
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: Фильтр по имени файла
 *     responses:
 *       200:
 *         description: Список файлов
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
 *                     $ref: '#/components/schemas/FileInfo'
 *                 timestamp:
 *                   type: string
 */
  router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { recursive = 'false', filter } = req.query;
    const isRecursive = recursive === 'true';
    const fileFilter = filter as string | undefined;

    logger.info('Fetching files list', { recursive: isRecursive, filter: fileFilter });

    const files = await getFilesRecursive(
      config.workspaceDir, 
      isRecursive,
      fileFilter
    );

    const response: ApiResponse<FileInfo[]> = {
      success: true,
      data: files,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  /**
 * @openapi
 * /api/files/{path}:
 *   get:
 *     summary: Получить содержимое файла или директории
 *     tags:
 *       - Files
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Путь к файлу или директории
 *     responses:
 *       200:
 *         description: Содержимое файла или список файлов в директории
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/FileContent'
 *                     - type: array
 *                       items:
 *                         $ref: '#/components/schemas/FileInfo'
 *                 timestamp:
 *                   type: string
 */
  router.get('/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const relativePath = req.params.path;
    
    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    const safePath = config.getSecureWorkspacePath(relativePath);
    
    logger.info('Fetching file content', { path: safePath });

    // Проверяем существование файла
    try {
      const stats = await stat(safePath);
      
      if (stats.isDirectory()) {
        // Если это директория, возвращаем список файлов в ней
        const files = await getFilesInDirectory(safePath);
        const response: ApiResponse<FileInfo[]> = {
          success: true,
          data: files,
          timestamp: new Date().toISOString()
        };
        res.json(response);
        return;
      }

      // Проверяем расширение файла
      if (!config.isAllowedFileExtension(safePath)) {
        throw new ForbiddenError('File type not allowed');
      }

      // Читаем содержимое файла
      const content = await fs.readFile(safePath, 'utf-8');
      
      const fileContent: FileContent = {
        path: relativePath,
        content,
        size: stats.size,
        encoding: 'utf-8',
        modifiedAt: stats.mtime.toISOString()
      };

      const response: ApiResponse<FileContent> = {
        success: true,
        data: fileContent,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('File', relativePath);
      }
      throw error;
    }
  }));

  /**
 * @openapi
 * /api/files/project/{projectId}:
 *   post:
 *     summary: Создать или обновить файл в проекте
 *     tags:
 *       - Files
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID проекта
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: Путь к файлу в проекте
 *               content:
 *                 type: string
 *               encoding:
 *                 type: string
 *                 default: utf-8
 *     responses:
 *       200:
 *         description: Файл создан или обновлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FileInfo'
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
  router.post('/project/:projectId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const { filePath, content, encoding = 'utf-8' } = req.body;

    if (!projectId) {
      throw new ValidationError('Project ID is required', 'projectId');
    }
    if (!filePath) {
      throw new ValidationError('File path is required', 'filePath');
    }
    if (content === undefined) {
      throw new ValidationError('Content is required', 'content');
    }

    const project = await projectService.getProject(projectId);
    if (!project) {
      throw new NotFoundError('Project', projectId);
    }
    
    const safeFilePath = config.getSecurePath(project.path, filePath);
    logger.info('Creating/updating project file', { projectId, path: safeFilePath });

    if (!config.isAllowedFileExtension(safeFilePath)) {
      throw new ForbiddenError('File type not allowed');
    }

    const dirPath = path.dirname(safeFilePath);
    await fs.mkdir(dirPath, { recursive: true });

    const fileExists = await fs.access(safeFilePath).then(() => true).catch(() => false);
    const operationType: FileOperation['type'] = fileExists ? 'update' : 'create';

    await fs.writeFile(safeFilePath, content, encoding);

    const stats = await stat(safeFilePath);
    const fileInfo: FileInfo = {
      name: path.basename(safeFilePath),
      path: filePath, // Возвращаем относительный путь
      type: 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      isReadable: true,
      isWritable: true,
    };

    const response: ApiResponse<FileInfo> = {
      success: true,
      data: fileInfo,
      message: `File ${operationType === 'create' ? 'created' : 'updated'} successfully`,
      timestamp: new Date().toISOString(),
    };

    res.status(operationType === 'create' ? 201 : 200).json(response);
  }));

  /**
 * @openapi
 * /api/files/{path}:
 *   delete:
 *     summary: Удалить файл или директорию
 *     tags:
 *       - Files
 *     parameters:
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Путь к файлу или директории
 *     responses:
 *       200:
 *         description: Файл или директория удалены
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: 'null'
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 */
  router.delete('/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const relativePath = req.params.path;

    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    const safePath = config.getSecureWorkspacePath(relativePath);
    
    logger.info('Deleting file', { path: safePath });

    try {
      const stats = await stat(safePath);
      
      if (stats.isDirectory()) {
        // Удаляем директорию рекурсивно
        await fs.rm(safePath, { recursive: true });
      } else {
        // Удаляем файл
        await fs.unlink(safePath);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'File deleted successfully',
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError('File', relativePath);
      }
      throw error;
    }
  }));

  return router;
};

// Вспомогательные функции
async function getFilesRecursive(
  dirPath: string, 
  recursive: boolean = false,
  filter?: string
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(config.workspaceDir, fullPath);
      
      // Пропускаем скрытые файлы и node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      // Применяем фильтр если указан
      if (filter && !entry.name.includes(filter)) {
        continue;
      }

      const stats = await stat(fullPath);
      const fileInfo: FileInfo = {
        name: entry.name,
        path: relativePath,
        size: stats.size,
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: entry.isFile() ? path.extname(entry.name) : undefined,
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString(),
        isReadable: true,
        isWritable: true
      };

      files.push(fileInfo);

      // Рекурсивно обходим директории
      if (recursive && entry.isDirectory()) {
        const subFiles = await getFilesRecursive(fullPath, recursive, filter);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    logger.error('Error reading directory', { dirPath, error });
  }

  return files;
}

async function getFilesInDirectory(dirPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(config.workspaceDir, fullPath);
      
      // Пропускаем скрытые файлы
      if (entry.name.startsWith('.')) {
        continue;
      }

      const stats = await stat(fullPath);
      const fileInfo: FileInfo = {
        name: entry.name,
        path: relativePath,
        size: stats.size,
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: entry.isFile() ? path.extname(entry.name) : undefined,
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString(),
        isReadable: true,
        isWritable: true
      };

      files.push(fileInfo);
    }
  } catch (error) {
    logger.error('Error reading directory', { dirPath, error });
  }

  return files;
} 