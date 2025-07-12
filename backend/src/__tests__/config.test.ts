import { AppConfig } from '../config/app-config';

describe('AppConfig', () => {
  let config: AppConfig;
  const originalEnv = process.env;

  beforeEach(() => {
    // Сбрасываем переменные окружения
    process.env = { ...originalEnv };
    config = new AppConfig();
  });

  afterEach(() => {
    // Восстанавливаем переменные окружения
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should use default values when env variables are not set', () => {
      expect(config.port).toBe(3000);
      expect(config.host).toBe('localhost');
      expect(config.nodeEnv).toBe('test'); // В тестовом окружении NODE_ENV='test'
      expect(config.logLevel).toBe('silent'); // В тестовом окружении LOG_LEVEL='silent'
    });

    it('should use env variables when they are set', () => {
      process.env.PORT = '8080';
      process.env.HOST = '0.0.0.0';
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';

      const envConfig = new AppConfig();
      
      expect(envConfig.port).toBe(8080);
      expect(envConfig.host).toBe('0.0.0.0');
      expect(envConfig.nodeEnv).toBe('production');
      expect(envConfig.logLevel).toBe('error');
    });

    it('should parse CORS_ORIGIN as array', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:5173';
      
      const envConfig = new AppConfig();
      
      expect(envConfig.corsOrigin).toEqual([
        'http://localhost:3000',
        'http://localhost:5173'
      ]);
    });

    it('should use default CORS_ORIGIN when not set', () => {
      expect(config.corsOrigin).toEqual([
        'http://localhost:3000',
        'http://localhost:5173'
      ]);
    });
  });

  describe('isProduction', () => {
    it('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const prodConfig = new AppConfig();
      
      expect(prodConfig.isProduction()).toBe(true);
    });

    it('should return false when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'development';
      const devConfig = new AppConfig();
      
      expect(devConfig.isProduction()).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const devConfig = new AppConfig();
      
      expect(devConfig.isDevelopment()).toBe(true);
    });

    it('should return false when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'production';
      const prodConfig = new AppConfig();
      
      expect(prodConfig.isDevelopment()).toBe(false);
    });
  });

  describe('isAllowedFileExtension', () => {
    it('should return true for allowed extensions', () => {
      expect(config.isAllowedFileExtension('test.js')).toBe(true);
      expect(config.isAllowedFileExtension('test.ts')).toBe(true);
      expect(config.isAllowedFileExtension('test.json')).toBe(true);
      expect(config.isAllowedFileExtension('test.html')).toBe(true);
      expect(config.isAllowedFileExtension('test.css')).toBe(true);
    });

    it('should return false for disallowed extensions', () => {
      expect(config.isAllowedFileExtension('test.exe')).toBe(false);
      expect(config.isAllowedFileExtension('test.bin')).toBe(false);
      expect(config.isAllowedFileExtension('test.dll')).toBe(false);
    });

    it('should handle files without extensions', () => {
      expect(config.isAllowedFileExtension('README')).toBe(false);
      expect(config.isAllowedFileExtension('Dockerfile')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(config.isAllowedFileExtension('test.JS')).toBe(true);
      expect(config.isAllowedFileExtension('test.TS')).toBe(true);
      expect(config.isAllowedFileExtension('test.JSON')).toBe(true);
    });
  });

  describe('getSecureWorkspacePath', () => {
    it('should return secure path within workspace', () => {
      const safePath = config.getSecureWorkspacePath('test.js');
      expect(safePath).toContain('workspace');
      expect(safePath).toContain('test.js');
    });

    it('should prevent path traversal attacks', () => {
      const safePath = config.getSecureWorkspacePath('../../../etc/passwd');
      expect(safePath).not.toContain('../');
      expect(safePath).toContain('workspace');
    });

    it('should normalize paths', () => {
      const safePath = config.getSecureWorkspacePath('./test/../file.js');
      expect(safePath).toContain('file.js');
      expect(safePath).not.toContain('../');
    });
  });
}); 