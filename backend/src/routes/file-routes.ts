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

const config = new AppConfig();

export const setupFileRoutes = (): Router => {
  const router = Router();

  // GET /api/files - получить список файлов
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

  // GET /api/files/:path - получить содержимое файла
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

  // POST /api/files/:path - создать или обновить файл
  router.post('/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const relativePath = req.params.path;
    const { content, encoding = 'utf-8' } = req.body;

    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    if (content === undefined) {
      throw new ValidationError('Content is required', 'content');
    }

    const safePath = config.getSecureWorkspacePath(relativePath);
    
    logger.info('Creating/updating file', { path: safePath });

    // Проверяем расширение файла
    if (!config.isAllowedFileExtension(safePath)) {
      throw new ForbiddenError('File type not allowed');
    }

    // Создаем директорию если она не существует
    const dirPath = path.dirname(safePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Определяем тип операции
    const fileExists = await fs.access(safePath).then(() => true).catch(() => false);
    const operationType: FileOperation['type'] = fileExists ? 'update' : 'create';

    // Записываем файл
    await fs.writeFile(safePath, content, encoding);

    const stats = await stat(safePath);
    const fileInfo: FileInfo = {
      name: path.basename(safePath),
      path: relativePath,
      size: stats.size,
      type: 'file',
      extension: path.extname(safePath),
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      isReadable: true,
      isWritable: true
    };

    const response: ApiResponse<FileInfo> = {
      success: true,
      data: fileInfo,
      message: `File ${operationType}d successfully`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // DELETE /api/files/:path - удалить файл
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