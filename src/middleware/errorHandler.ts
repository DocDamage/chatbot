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

  let message = error.message;
  let errorCode = isEntityTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';

  if (isEntityTooLarge) {
    message = 'Payload too large';
    errorCode = 'PAYLOAD_TOO_LARGE';
  } else if (process.env.NODE_ENV === 'production') {
    switch (statusCode) {
      case 400:
        message = 'Bad request';
        errorCode = 'BAD_REQUEST';
        break;
      case 401:
        message = 'Authentication required';
        errorCode = 'AUTHENTICATION_ERROR';
        break;
      case 403:
        message = 'Access denied';
        errorCode = 'AUTHORIZATION_ERROR';
        break;
      case 404:
        message = 'Resource not found';
        errorCode = 'NOT_FOUND';
        break;
      case 429:
        message = 'Too many requests';
        errorCode = 'RATE_LIMIT_EXCEEDED';
        break;
      case 503:
        message = 'Service unavailable';
        errorCode = 'SERVICE_UNAVAILABLE';
        break;
      default:
        message = 'Internal server error';
        errorCode = 'INTERNAL_ERROR';
        break;
    }
  }

  res.status(statusCode).json(formatApiError(
    message,
    statusCode,
    errorCode
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

