import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, string | number | boolean>;
}

export const errorHandler = (
  error: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Логируем ошибку
  logger.error(`Error ${statusCode}: ${message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: error.stack
  });

  const response: ApiResponse<null> = {
    success: false,
    error: message,
    data: null,
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Фабрика для создания типизированных ошибок
export class AppError extends Error implements CustomError {
  public statusCode: number;
  public code: string;
  public details?: Record<string, string | number | boolean>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, string | number | boolean>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, value?: string) {
    super(message, 400, 'VALIDATION_ERROR', {
      field: field || 'unknown',
      value: value || 'unknown'
    });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} ${id ? `with id ${id}` : ''} not found`,
      404,
      'NOT_FOUND',
      { resource, id: id || 'unknown' }
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, resource?: string) {
    super(message, 409, 'CONFLICT', { resource: resource || 'unknown' });
    this.name = 'ConflictError';
  }
} 