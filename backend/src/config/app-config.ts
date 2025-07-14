import path from 'path';
import fs from 'fs';

export class AppConfig {
  public readonly port: number;
  public readonly host: string;
  public readonly corsOrigin: string | string[];
  public readonly workspaceDir: string;
  public readonly projectsDir: string;
  public readonly geminiApiKey: string;
  public readonly jwtSecret: string;
  public readonly nodeEnv: string;
  public readonly logLevel: string;
  public readonly maxFileSize: number;
  public readonly allowedFileExtensions: string[];

  constructor() {
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.host = process.env.HOST || '0.0.0.0';
    this.corsOrigin = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:5173'];
    
    this.workspaceDir = process.env.WORKSPACE_DIR 
      ? path.resolve(process.env.WORKSPACE_DIR)
      : path.join(process.cwd(), 'workspace');
    
    this.projectsDir = path.join(this.workspaceDir, 'projects');

    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB
    
    this.allowedFileExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss', '.sass',
      '.vue', '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.rs', '.go', '.php',
      '.rb', '.swift', '.kt', '.dart', '.sh', '.bash', '.zsh', '.fish', '.ps1',
      '.md', '.txt', '.yml', '.yaml', '.xml', '.toml', '.ini', '.env', '.gitignore',
      '.dockerfile', '.dockerignore', '.sql', '.graphql', '.proto', '.lock'
    ];

    // Создаем рабочую директорию если она не существует
    this.ensureWorkspaceDir();
  }

  private ensureWorkspaceDir(): void {
    if (!fs.existsSync(this.workspaceDir)) {
      fs.mkdirSync(this.workspaceDir, { recursive: true });
    }
  }

  public isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  public isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  public isAllowedFileExtension(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.allowedFileExtensions.includes(ext);
  }

  public getSecureWorkspacePath(relativePath: string): string {
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
    return path.join(this.workspaceDir, safePath);
  }

  public getSecurePath(basePath: string, relativePath: string): string {
    const resolvedPath = path.resolve(basePath, relativePath);
    // Ensure the path is within the base directory to prevent directory traversal
    if (!resolvedPath.startsWith(path.resolve(basePath))) {
      throw new Error('Access to path outside of the allowed directory is forbidden.');
    }
    return resolvedPath;
  }
} 

let configInstance: AppConfig;

export const loadConfig = (): AppConfig => {
  if (!configInstance) {
    configInstance = new AppConfig();
  }
  return configInstance;
}; 