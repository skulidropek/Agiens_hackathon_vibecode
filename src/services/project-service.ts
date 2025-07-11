import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { Project, CreateProjectRequest, ProjectListResponse, ProjectStats } from '../types/project';
import { logger } from '../utils/logger';

export class ProjectService {
  private projectsDir: string;
  private projectsFile: string;
  private projects: Map<string, Project> = new Map();
  private activeProjectId: string | null = null;

  constructor(workspaceDir: string) {
    this.projectsDir = join(workspaceDir, 'projects');
    this.projectsFile = join(this.projectsDir, '.projects.json');
    this.initializeProjectsDirectory();
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async initializeProjectsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      await this.loadProjects();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ошибка инициализации директории проектов:', errorMessage);
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const data = await fs.readFile(this.projectsFile, 'utf8');
      const projectsData = JSON.parse(data);
      
      this.projects.clear();
      this.activeProjectId = projectsData.activeProjectId || null;
      
      for (const project of projectsData.projects || []) {
        this.projects.set(project.id, {
          ...project,
          createdAt: new Date(project.createdAt),
          lastAccessed: new Date(project.lastAccessed)
        });
      }
    } catch (error) {
      const errorWithCode = error as { code?: string };
      if (errorWithCode.code !== 'ENOENT') {
        logger.error('Ошибка загрузки проектов:', this.formatError(error));
      }
    }
  }

  private async saveProjects(): Promise<void> {
    try {
      const projectsData = {
        activeProjectId: this.activeProjectId,
        projects: Array.from(this.projects.values()).map(project => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
          lastAccessed: project.lastAccessed.toISOString()
        }))
      };
      
      await fs.writeFile(this.projectsFile, JSON.stringify(projectsData, null, 2));
    } catch (error) {
      logger.error('Ошибка сохранения проектов:', this.formatError(error));
    }
  }

  async createProject(request: CreateProjectRequest): Promise<Project> {
    const id = uuidv4();
    const projectPath = join(this.projectsDir, request.name);
    
    const project: Project = {
      id,
      name: request.name,
      path: projectPath,
      type: request.type,
      gitUrl: request.gitUrl,
      branch: request.branch || 'main',
      description: request.description,
      createdAt: new Date(),
      lastAccessed: new Date(),
      isActive: false
    };

    try {
      if (request.type === 'git') {
        if (!request.gitUrl) {
          throw new Error('Git URL обязателен для Git проектов');
        }
        await this.cloneRepository(request.gitUrl, projectPath, request.branch);
      } else {
        await fs.mkdir(projectPath, { recursive: true });
      }

      this.projects.set(id, project);
      await this.saveProjects();
      
      logger.info(`Создан проект: ${request.name} (${request.type})`);
      return project;
    } catch (error) {
      logger.error(`Ошибка создания проекта ${request.name}:`, this.formatError(error));
      throw error;
    }
  }

  private async cloneRepository(gitUrl: string, targetPath: string, branch?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['clone'];
      if (branch) {
        args.push('--branch', branch);
      }
      args.push(gitUrl, targetPath);

      const gitProcess = spawn('git', args);
      
      let stderr = '';
      gitProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Git clone failed: ${stderr}`));
        }
      });
    });
  }

  async listProjects(): Promise<ProjectListResponse> {
    const projects = Array.from(this.projects.values());
    const activeProject = this.activeProjectId ? this.projects.get(this.activeProjectId) : undefined;
    
    return {
      projects,
      activeProject
    };
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async activateProject(id: string): Promise<Project> {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Проект с ID ${id} не найден`);
    }

    // Деактивируем текущий активный проект
    if (this.activeProjectId) {
      const currentActive = this.projects.get(this.activeProjectId);
      if (currentActive) {
        currentActive.isActive = false;
      }
    }

    // Активируем новый проект
    project.isActive = true;
    project.lastAccessed = new Date();
    this.activeProjectId = id;

    await this.saveProjects();
    
    logger.info(`Активирован проект: ${project.name}`);
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const project = this.projects.get(id);
    if (!project) {
      return false;
    }

    try {
      // Удаляем папку проекта
      await fs.rm(project.path, { recursive: true, force: true });
      
      // Удаляем из коллекции
      this.projects.delete(id);
      
      // Если это был активный проект, деактивируем
      if (this.activeProjectId === id) {
        this.activeProjectId = null;
      }

      await this.saveProjects();
      
      logger.info(`Удален проект: ${project.name}`);
      return true;
    } catch (error) {
      logger.error(`Ошибка удаления проекта ${project.name}:`, this.formatError(error));
      throw error;
    }
  }

  async getProjectStats(): Promise<ProjectStats> {
    const projects = Array.from(this.projects.values());
    
    return {
      totalProjects: projects.length,
      gitProjects: projects.filter(p => p.type === 'git').length,
      localProjects: projects.filter(p => p.type === 'local').length,
      activeProject: this.activeProjectId || undefined
    };
  }

  getActiveProject(): Project | undefined {
    return this.activeProjectId ? this.projects.get(this.activeProjectId) : undefined;
  }

  getProjectsDirectory(): string {
    return this.projectsDir;
  }
} 