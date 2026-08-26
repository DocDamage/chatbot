/**
 * Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../core/observability/logger';
import { formatApiError } from './apiErrorSchema';

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Request error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Handle known errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json(formatApiError(
      error.message,
      error.statusCode,
      error.code,
      error.details
    ));
    return;
  }

  // Handle unknown or framework errors with status/statusCode
  const statusCode = (error as any).status || (error as any).statusCode || 500;
  const isEntityTooLarge = (error as any).type === 'entity.too.large' || statusCode === 413;
  const message = isEntityTooLarge
    ? 'Payload too large'
    : (process.env.NODE_ENV === 'production' && statusCode === 500)
    ? 'Internal server error'
    : error.message;

  res.status(statusCode).json(formatApiError(
    message,
    statusCode,
    isEntityTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR'
  ));
};

/**
 * Async error wrapper
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

