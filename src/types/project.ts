export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'git' | 'local';
  gitUrl?: string;
  branch?: string;
  description?: string;
  createdAt: Date;
  lastAccessed: Date;
  isActive?: boolean;
}

export interface CreateProjectRequest {
  name: string;
  type: 'git' | 'local';
  gitUrl?: string;
  branch?: string;
  description?: string;
}

export interface ProjectListResponse {
  projects: Project[];
  activeProject?: Project;
}

export interface ProjectStats {
  totalProjects: number;
  gitProjects: number;
  localProjects: number;
  activeProject?: string;
}

export interface GitCloneOptions {
  url: string;
  branch?: string;
  depth?: number;
} 