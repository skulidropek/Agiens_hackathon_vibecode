import { logger, LogLevel } from '../utils/logger';

// Полностью отключаем логирование в тестах
logger.setLevel(LogLevel.SILENT);

// Альтернативно можно замокать весь логгер
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  // Отключаем все консольные выводы в тестах
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  // Восстанавливаем консольные выводы после тестов
  console.log = originalLog;
  console.error = originalError;
});

// Мок для WebSocket
class MockWebSocket {
  public readyState = 1;
  public static OPEN = 1;
  public static CLOSED = 3;
  public static CONNECTING = 0;
  public static CLOSING = 2;
  
  public send = jest.fn();
  public close = jest.fn();
  public ping = jest.fn();
  public pong = jest.fn();
  public terminate = jest.fn();
  public on = jest.fn();
  public once = jest.fn();
  public off = jest.fn();
  public addEventListener = jest.fn();
  public removeEventListener = jest.fn();
  
  constructor(public url: string) {}
}

// Мок для process.env
process.env.NODE_ENV = 'test';
process.env.WORKSPACE_DIR = './test-workspace';
process.env.LOG_LEVEL = 'silent'; // Новый уровень для полного отключения

// Очистка после каждого теста
afterEach(() => {
  jest.clearAllMocks();
});

// Экспорт для использования в тестах
export const mockWebSocket = MockWebSocket; 