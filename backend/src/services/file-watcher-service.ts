import chokidar from 'chokidar';
import { relative, join, extname } from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger';
import { broadcastToType, sendToConnection } from '../websocket/websocket-handler';
import { FileInfo, FileEventData } from '../types';
import { ProjectService } from './project-service';

export interface FileWatcherStartOptions {
  projectId: string;
  connectionId: string;
  ignored?: string[];
  persistent?: boolean;
  ignoreInitial?: boolean;
}

export class FileWatcherService {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private projectService: ProjectService;

  constructor(projectService: ProjectService) {
    this.projectService = projectService;
    logger.info('FileWatcherService initialized');
  }

  public async startWatching(options: FileWatcherStartOptions): Promise<void> {
    const { projectId, connectionId, ignored = [], persistent = true } = options;

    if (this.watchers.has(projectId)) {
      logger.warn('Already watching project, sending current state to new client', { projectId, connectionId });
      const project = await this.projectService.getProject(projectId);
      if (project) {
        await this.getAndSendInitialFiles(projectId, project.path, connectionId);
      }
      return;
    }

    const project = await this.projectService.getProject(projectId);
    if (!project) {
      logger.error('Project not found for file watching', { projectId });
      // Отправить ошибку клиенту?
      return;
    }
    const projectPath = project.path;

    // Создаем watcher
    const watcher = chokidar.watch(projectPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/.cursor/**',
        '**/*.log',
        '**/*.tmp',
        '**/*.temp',
        ...ignored
      ],
      persistent,
      ignoreInitial: true, // Устанавливаем в true, чтобы избежать событий 'add' при сканировании
      followSymlinks: false,
      depth: 10,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    // Настраиваем обработчики событий
    watcher
      .on('add', (filePath) => {
        logger.info('File added event', { filePath, projectId });
        this.handleFileEvent('file_created', filePath, projectId, projectPath);
      })
      .on('change', (filePath) => {
        logger.info('File changed event', { filePath, projectId });
        this.handleFileEvent('file_modified', filePath, projectId, projectPath);
      })
      .on('unlink', (filePath) => {
        logger.info('File deleted event', { filePath, projectId });
        this.handleFileEvent('file_deleted', filePath, projectId, projectPath);
      })
      .on('addDir', (dirPath) => {
        logger.info('Directory added event', { dirPath, projectId });
        this.handleFileEvent('directory_created', dirPath, projectId, projectPath);
      })
      .on('unlinkDir', (dirPath) => {
        logger.info('Directory deleted event', { dirPath, projectId });
        this.handleFileEvent('directory_deleted', dirPath, projectId, projectPath);
      })
      .on('error', (error) => {
        logger.error('File watcher error', { projectId, error: error.message });
        this.broadcastFileEvent(projectId, 'file_error', '', {
          error: error.message,
          projectId
        });
      })
      .on('ready', async () => {
        logger.info('File watcher ready, broadcasting initial file list', { projectId, projectPath });
        // Отправляем начальный список файлов всем подписчикам
        await this.getAndSendInitialFiles(projectId, projectPath);
      });

    this.watchers.set(projectId, watcher);
    logger.info('Started watching project', { projectId, projectPath });
  }

  public stopWatching(projectId: string): void {
    const watcher = this.watchers.get(projectId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(projectId);
      logger.info('Stopped watching project', { projectId });
    }
  }

  public stopAll(): void {
    for (const [projectId, watcher] of this.watchers) {
      watcher.close();
      logger.info('Stopped watching project during cleanup', { projectId });
    }
    this.watchers.clear();
  }

  public getWatchedProjects(): string[] {
    return Array.from(this.watchers.keys());
  }

  public isWatching(projectId: string): boolean {
    return this.watchers.has(projectId);
  }

  private async handleFileEvent(
    eventType: 'file_created' | 'file_modified' | 'file_deleted' | 'directory_created' | 'directory_deleted',
    filePath: string,
    projectId: string,
    projectPath: string
  ): Promise<void> {
    try {
      const relativePath = relative(projectPath, filePath);
      
      // Игнорируем события из корневой директории проекта (пустая строка)
      if (relativePath === '') {
        return;
      }

      // Получаем информацию о файле (если он существует)
      let fileInfo: FileInfo | null = null;
      
      if (eventType !== 'file_deleted' && eventType !== 'directory_deleted') {
        try {
          const stats = await fs.stat(filePath);
          const isDirectory = stats.isDirectory();
          
          fileInfo = {
            name: relativePath.split('/').pop() || '',
            path: relativePath,
            size: isDirectory ? 0 : stats.size,
            type: isDirectory ? 'directory' : 'file',
            extension: isDirectory ? undefined : filePath.split('.').pop(),
            modifiedAt: stats.mtime.toISOString(),
            createdAt: stats.birthtime.toISOString(),
            isReadable: true, // Предполагаем, что файл читаемый
            isWritable: true  // Предполагаем, что файл доступен для записи
          };
        } catch (error) {
          logger.warn('Failed to get file stats', { filePath, error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Создаем данные события
      const eventData: FileEventData = {
        filePath: relativePath,
        fileName: relativePath.split('/').pop() || '',
        fileSize: fileInfo?.size,
        operation: this.mapEventTypeToOperation(eventType)
      };

      // Отправляем событие через WebSocket
      this.broadcastFileEvent(projectId, eventType, relativePath, {
        projectId,
        fileInfo,
        eventData
      });

      logger.debug('File event processed', {
        projectId,
        eventType,
        filePath: relativePath,
        fileSize: fileInfo?.size
      });

    } catch (error) {
      logger.error('Error handling file event', {
        projectId,
        eventType,
        filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private mapEventTypeToOperation(eventType: string): 'create' | 'update' | 'delete' | 'rename' {
    switch (eventType) {
      case 'file_created':
      case 'directory_created':
        return 'create';
      case 'file_modified':
        return 'update';
      case 'file_deleted':
      case 'directory_deleted':
        return 'delete';
      default:
        return 'update';
    }
  }

  private sendFileEventToConnection(connectionId: string, projectId: string, eventType: string, filePath: string, data: Record<string, unknown>): void {
    const message = {
      type: 'file_event',
      eventType,
      projectId,
      filePath,
      timestamp: new Date().toISOString(),
      data
    };

    sendToConnection(connectionId, message);
    
    logger.debug('File event sent to connection', {
      connectionId,
      projectId,
      eventType,
      filePath,
    });
  }

  private broadcastFileEvent(projectId: string, eventType: string, filePath: string, data: Record<string, unknown>): void {
    const message = {
      type: 'file_event',
      eventType,
      projectId,
      filePath,
      timestamp: new Date().toISOString(),
      data
    };

    // Отправляем всем подключенным клиентам типа 'files'
    broadcastToType('files', message);
    
    logger.debug('File event broadcasted', {
      projectId,
      eventType,
      filePath,
      connectionsNotified: 'files'
    });
  }

  private async getAndSendInitialFiles(projectId: string, projectPath: string, connectionId?: string): Promise<void> {
    try {
      const initialFiles = await this.getInitialFiles(projectPath);
      const loggerMeta = { projectId, filesCount: initialFiles.length, target: connectionId || 'broadcast' };
      
      logger.info('Sending initial files', loggerMeta);

      const readyData = { projectId, projectPath };
      
      if (connectionId) {
        this.sendFileEventToConnection(connectionId, projectId, 'watcher_ready', '', readyData);
      } else {
        this.broadcastFileEvent(projectId, 'watcher_ready', '', readyData);
      }
      
      for (const fileInfo of initialFiles) {
        const eventType = fileInfo.type === 'directory' ? 'directory_created' : 'file_created';
        const data = { projectId, fileInfo };
        
        if (connectionId) {
          this.sendFileEventToConnection(connectionId, projectId, eventType, fileInfo.path, data);
        } else {
          this.broadcastFileEvent(projectId, eventType, fileInfo.path, data);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Error sending initial files', { projectId, error: errorMsg });
      
      const errorData = { error: `Failed to send initial file list for project ${projectId}.`, projectId };
      if (connectionId) {
        this.sendFileEventToConnection(connectionId, projectId, 'file_error', '', errorData);
      } else {
        this.broadcastFileEvent(projectId, 'file_error', '', errorData);
      }
    }
  }

  private async getInitialFiles(projectPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(projectPath, entry.name);
        const relativePath = entry.name;
        
        // Пропускаем скрытые файлы и папки (кроме важных)
        if (entry.name.startsWith('.') && !this.isImportantHiddenFile(entry.name)) {
          continue;
        }

        // Пропускаем node_modules и другие служебные папки
        if (this.isIgnoredDirectory(entry.name)) {
          continue;
        }

        const stats = await fs.stat(fullPath);
        const fileInfo: FileInfo = {
          name: entry.name,
          path: relativePath,
          size: entry.isDirectory() ? 0 : stats.size,
          type: entry.isDirectory() ? 'directory' : 'file',
          extension: entry.isFile() ? extname(entry.name) : undefined,
          modifiedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString(),
          isReadable: true,
          isWritable: true
        };

        files.push(fileInfo);

        // Рекурсивно обрабатываем директории
        if (entry.isDirectory()) {
          const subFiles = await this.getInitialFilesRecursive(fullPath, relativePath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      logger.error('Error reading initial files', { projectPath, error: error instanceof Error ? error.message : String(error) });
    }

    return files;
  }

  private async getInitialFilesRecursive(dirPath: string, baseRelativePath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const relativePath = join(baseRelativePath, entry.name);
        
        // Пропускаем скрытые файлы и папки (кроме важных)
        if (entry.name.startsWith('.') && !this.isImportantHiddenFile(entry.name)) {
          continue;
        }

        // Пропускаем node_modules и другие служебные папки
        if (this.isIgnoredDirectory(entry.name)) {
          continue;
        }

        const stats = await fs.stat(fullPath);
        const fileInfo: FileInfo = {
          name: entry.name,
          path: relativePath,
          size: entry.isDirectory() ? 0 : stats.size,
          type: entry.isDirectory() ? 'directory' : 'file',
          extension: entry.isFile() ? extname(entry.name) : undefined,
          modifiedAt: stats.mtime.toISOString(),
          createdAt: stats.birthtime.toISOString(),
          isReadable: true,
          isWritable: true
        };

        files.push(fileInfo);

        // Рекурсивно обрабатываем директории
        if (entry.isDirectory()) {
          const subFiles = await this.getInitialFilesRecursive(fullPath, relativePath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      logger.error('Error reading recursive files', { dirPath, error: error instanceof Error ? error.message : String(error) });
    }

    return files;
  }

  private isImportantHiddenFile(name: string): boolean {
    const importantFiles = ['.gitignore', '.env', '.env.example', '.dockerignore'];
    return importantFiles.includes(name);
  }

  private isIgnoredDirectory(name: string): boolean {
    const ignoredDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.vscode', '.cursor'];
    return ignoredDirs.includes(name);
  }
}

// Экспортируем singleton instance
// Это нужно будет изменить в index.ts
// export const fileWatcherService = new FileWatcherService(); 