import { ProjectService } from './project-service';
import { AIContext, FileInfo, Session } from '../types';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

export class ProjectChatService {
  constructor(private projectService: ProjectService) {}

  /**
   * Получить AI контекст для активного проекта
   */
  async getAIContext(projectId: string): Promise<AIContext> {
    const project = await this.projectService.getProject(projectId);
    if (!project) { throw new Error('Project not found'); }
    
    try {
      const projectFiles = await this.getProjectFiles(project.path);
      
      return {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        workspaceFiles: projectFiles,
        currentDirectory: project.path,
        terminalHistory: [],
        chatHistory: []
      };
    } catch (error) {
      logger.error('Error building AI context:', error instanceof Error ? error.message : String(error));
      return {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        workspaceFiles: [],
        currentDirectory: project.path,
        terminalHistory: [],
        chatHistory: []
      };
    }
  }

  /**
   * Получить файлы проекта для AI контекста
   */
  private async getProjectFiles(projectPath: string): Promise<FileInfo[]> {
    try {
      const files = await this.getFilesRecursive(projectPath);
      return files.filter(file => this.isRelevantForAI(file));
    } catch (error) {
      logger.error('Error getting project files:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Рекурсивно получить все файлы в проекте
   */
  private async getFilesRecursive(dirPath: string, basePath?: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const actualBasePath = basePath || dirPath;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const relativePath = fullPath.replace(actualBasePath, '').replace(/^\//, '');

        // Пропускаем скрытые файлы и папки (кроме важных)
        if (entry.name.startsWith('.') && !this.isImportantHiddenFile(entry.name)) {
          continue;
        }

        // Пропускаем node_modules и другие служебные папки
        if (this.isIgnoredDirectory(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Рекурсивно обрабатываем папки
          const subFiles = await this.getFilesRecursive(fullPath, actualBasePath);
          files.push(...subFiles);
        } else {
          // Добавляем файл
          const stats = await fs.stat(fullPath);
          const fileInfo: FileInfo = {
            name: entry.name,
            path: relativePath,
            size: stats.size,
            type: 'file',
            extension: extname(entry.name),
            modifiedAt: stats.mtime.toISOString(),
            createdAt: stats.birthtime.toISOString(),
            isReadable: true,
            isWritable: true
          };
          files.push(fileInfo);
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${dirPath}:`, error instanceof Error ? error.message : String(error));
    }

    return files;
  }

  /**
   * Проверить, является ли файл важным для AI
   */
  private isRelevantForAI(file: FileInfo): boolean {
    // Пропускаем слишком большие файлы
    if (file.size > 1024 * 1024) { // 1MB
      return false;
    }

    // Включаем только текстовые файлы
    const relevantExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss', '.sass',
      '.vue', '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.go', '.php',
      '.rb', '.swift', '.kt', '.dart', '.sh', '.bash', '.zsh', '.fish', '.ps1',
      '.md', '.txt', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env', '.gitignore',
      '.dockerfile', '.dockerignore', '.sql', '.graphql', '.proto'
    ];

    return relevantExtensions.includes(file.extension || '');
  }

  /**
   * Проверить, является ли скрытый файл важным
   */
  private isImportantHiddenFile(fileName: string): boolean {
    const importantFiles = [
      '.gitignore', '.env', '.env.example', '.dockerignore', 
      '.eslintrc.js', '.prettierrc', '.babelrc', '.npmrc'
    ];
    return importantFiles.includes(fileName);
  }

  /**
   * Проверить, нужно ли игнорировать папку
   */
  private isIgnoredDirectory(dirName: string): boolean {
    const ignoredDirs = [
      'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
      'coverage', '.nyc_output', 'tmp', 'temp', '__pycache__',
      '.pytest_cache', 'venv', '.venv', 'env', '.env'
    ];
    return ignoredDirs.includes(dirName);
  }

  /**
   * Получить безопасный путь в рамках активного проекта
   */
  async getSecureProjectPath(projectId: string, relativePath: string): Promise<string | null> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      return null;
    }

    // Нормализуем путь и убираем попытки выйти за пределы проекта
    const safePath = relativePath.replace(/^(\.\.[/\\])+/, '');
    return join(project.path, safePath);
  }

  /**
   * Проверить, принадлежит ли путь активному проекту
   */
  async isPathInActiveProject(projectId: string, absolutePath: string): Promise<boolean> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      return false;
    }

    return absolutePath.startsWith(project.path);
  }

  /**
   * Создать сессию чата для проекта
   */
  async createProjectSession(projectId: string, userId: string, conversationId: string): Promise<Session | null> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      return null;
    }

    const session: Session = {
      id: conversationId,
      userId,
      conversationId,
      projectId: project.id,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    return session;
  }

  /**
   * Получить статистику по проекту для AI
   */
  async getProjectStats(projectId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
    lastModified: string;
  }> {
    const project = await this.projectService.getProject(projectId);
    if (!project) {
      return {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
        lastModified: new Date().toISOString()
      };
    }

    const files = await this.getProjectFiles(project.path);
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      fileTypes: {} as Record<string, number>,
      lastModified: new Date().toISOString()
    };

    // Подсчитываем типы файлов
    for (const file of files) {
      const ext = file.extension || 'no-extension';
      stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
    }

    // Находим последнюю дату модификации
    if (files.length > 0) {
      const lastModified = files.reduce((latest, file) => {
        return new Date(file.modifiedAt) > new Date(latest) ? file.modifiedAt : latest;
      }, files[0].modifiedAt);
      stats.lastModified = lastModified;
    }

    return stats;
  }
} 