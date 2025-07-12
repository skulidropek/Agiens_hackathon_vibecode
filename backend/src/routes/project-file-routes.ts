import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { stat } from 'fs/promises';
import { ProjectChatService } from '../services/project-chat-service';
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

export function setupProjectFileRoutes(projectChatService: ProjectChatService): Router {
  const router = Router();

  // GET /api/files/project/:projectId - получить файлы проекта
  router.get('/project/:projectId', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const { recursive = 'false', filter } = req.query;
    const isRecursive = recursive === 'true';
    const fileFilter = filter as string | undefined;

    logger.info('Fetching project files list', { projectId, recursive: isRecursive, filter: fileFilter });

    const context = await projectChatService.getAIContext(projectId);
    
    let files = context.workspaceFiles;
    
    if (fileFilter) {
      files = files.filter(file => 
        file.name.toLowerCase().includes(fileFilter.toLowerCase()) ||
        file.path.toLowerCase().includes(fileFilter.toLowerCase())
      );
    }

    const response: ApiResponse<FileInfo[]> = {
      success: true,
      data: files,
      message: `Files from project: ${context.projectName}`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // GET /api/files/project/:projectId/:path - получить содержимое файла из проекта
  router.get('/project/:projectId/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const relativePath = req.params.path;
    
    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    const safePath = await projectChatService.getSecureProjectPath(projectId, relativePath);
    if (!safePath) {
      throw new ValidationError('Project not found', 'project');
    }
    
    logger.info('Fetching project file content', { projectId, path: safePath });

    try {
      const stats = await stat(safePath);
      
      if (stats.isDirectory()) {
        const files = await getFilesInDirectory(safePath);
        const response: ApiResponse<FileInfo[]> = {
          success: true,
          data: files,
          timestamp: new Date().toISOString()
        };
        res.json(response);
        return;
      }

      if (!isAllowedFileExtension(safePath)) {
        throw new ForbiddenError('File type not allowed');
      }

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

  // POST /api/files/project/:projectId/:path - создать или обновить файл в проекте
  router.post('/project/:projectId/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const relativePath = req.params.path;
    const { content, encoding = 'utf-8' } = req.body;

    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    if (content === undefined) {
      throw new ValidationError('Content is required', 'content');
    }

    const safePath = await projectChatService.getSecureProjectPath(projectId, relativePath);
    if (!safePath) {
      throw new ValidationError('Project not found', 'project');
    }
    
    logger.info('Creating/updating project file', { projectId, path: safePath });

    if (!isAllowedFileExtension(safePath)) {
      throw new ForbiddenError('File type not allowed');
    }

    const dirPath = path.dirname(safePath);
    await fs.mkdir(dirPath, { recursive: true });

    const fileExists = await fs.access(safePath).then(() => true).catch(() => false);
    const operationType: FileOperation['type'] = fileExists ? 'update' : 'create';

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
      message: `File ${operationType}d successfully in project`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  // DELETE /api/files/project/:projectId/:path - удалить файл из проекта
  router.delete('/project/:projectId/:path(*)', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const relativePath = req.params.path;

    if (!relativePath) {
      throw new ValidationError('Path parameter is required', 'path');
    }

    const safePath = await projectChatService.getSecureProjectPath(projectId, relativePath);
    if (!safePath) {
      throw new ValidationError('Project not found', 'project');
    }
    
    logger.info('Deleting project file', { projectId, path: safePath });

    try {
      const stats = await stat(safePath);
      
      if (stats.isDirectory()) {
        await fs.rm(safePath, { recursive: true });
      } else {
        await fs.unlink(safePath);
      }

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'File deleted successfully from project',
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

  // GET /api/files/project/:projectId/stats - получить статистику проекта
  router.get('/project/:projectId/stats', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId } = req.params;
    const stats = await projectChatService.getProjectStats(projectId);
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  }));

  return router;
}

// Вспомогательные функции
async function getFilesInDirectory(dirPath: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const stats = await stat(fullPath);
      
      const fileInfo: FileInfo = {
        name: entry.name,
        path: entry.name,
        size: entry.isDirectory() ? 0 : stats.size,
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: entry.isDirectory() ? undefined : path.extname(entry.name),
        modifiedAt: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString(),
        isReadable: true,
        isWritable: true
      };
      
      files.push(fileInfo);
    }
  } catch (error) {
    logger.error(`Error reading directory ${dirPath}:`, error instanceof Error ? error.message : String(error));
  }
  
  return files;
}

function isAllowedFileExtension(filename: string): boolean {
  const allowedExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss', '.sass',
    '.vue', '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.go', '.php',
    '.rb', '.swift', '.kt', '.dart', '.sh', '.bash', '.zsh', '.fish', '.ps1',
    '.md', '.txt', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env', '.gitignore',
    '.dockerfile', '.dockerignore', '.sql', '.graphql', '.proto', '.lock'
  ];
  
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
} 