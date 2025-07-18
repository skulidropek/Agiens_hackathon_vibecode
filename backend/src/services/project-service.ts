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

  constructor(workspaceDir: string) {
    this.projectsDir = join(workspaceDir, 'projects');
    this.projectsFile = join(this.projectsDir, '.projects.json');
    
    logger.info('ProjectService: Constructor called', {
      workspaceDir,
      projectsDir: this.projectsDir,
      projectsFile: this.projectsFile
    });
    
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

  async loadProjects(): Promise<void> {
    try {
      logger.info('ProjectService: Loading projects from file', {
        projectsFile: this.projectsFile
      });
      
      const data = await fs.readFile(this.projectsFile, 'utf8');
      const projectsData = JSON.parse(data);
      
      this.projects.clear();
      
      for (const project of projectsData.projects || []) {
        this.projects.set(project.id, {
          ...project,
          createdAt: new Date(project.createdAt),
          lastAccessed: new Date(project.lastAccessed)
        });
      }
      
      logger.info('ProjectService: Projects loaded successfully', {
        totalProjects: this.projects.size,
        projectIds: Array.from(this.projects.keys())
      });
    } catch (error) {
      const errorWithCode = error as { code?: string };
      if (errorWithCode.code !== 'ENOENT') {
        logger.error('Ошибка загрузки проектов:', this.formatError(error));
      } else {
        logger.info('ProjectService: Projects file not found, starting with empty projects list');
      }
    }
  }

  private async saveProjects(): Promise<void> {
    try {
      const projectsData = {
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
    
    logger.info('ProjectService: listProjects called', {
      totalProjects: projects.length,
      projectIds: projects.map(p => p.id),
      projectNames: projects.map(p => p.name)
    });
    
    return {
      projects,
      activeProject: undefined
    };
  }

  async getProject(idOrName: string): Promise<Project | undefined> {
    // First, try to find by ID, which is the most efficient lookup.
    if (this.projects.has(idOrName)) {
      return this.projects.get(idOrName);
    }

    // If not found by ID, search by name. This is less efficient but necessary.
    for (const project of this.projects.values()) {
      if (project.name === idOrName) {
        return project;
      }
    }

    return undefined;
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
      activeProject: undefined
    };
  }

  getProjectsDirectory(): string {
    return this.projectsDir;
  }
} 