import path from 'path';

export class PathManager {
  private static workspaceDir = path.join(process.cwd(), 'workspace');
  private static projectsDir = path.join(PathManager.workspaceDir, 'projects');

  /**
   * Получить путь к проекту по имени
   */
  static getProjectPath(projectName: string): string {
    return path.join(PathManager.projectsDir, projectName);
  }

  /**
   * Получить путь к рабочей директории
   */
  static getWorkspacePath(): string {
    return PathManager.workspaceDir;
  }

  /**
   * Получить путь к директории проектов
   */
  static getProjectsDirectory(): string {
    return PathManager.projectsDir;
  }

  /**
   * Проверить, существует ли проект
   */
  static async projectExists(projectName: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const projectPath = PathManager.getProjectPath(projectName);
      await fs.access(projectPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить список всех проектов
   */
  static async getProjectList(): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const entries = await fs.readdir(PathManager.projectsDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Нормализовать путь к проекту
   */
  static normalizeProjectPath(inputPath: string): string {
    // Если передан только имя проекта, добавляем полный путь
    if (!inputPath.includes('/') && !inputPath.includes('\\')) {
      return PathManager.getProjectPath(inputPath);
    }
    
    // Если передан относительный путь, делаем его абсолютным
    if (!path.isAbsolute(inputPath)) {
      return path.resolve(inputPath);
    }
    
    return inputPath;
  }
} 