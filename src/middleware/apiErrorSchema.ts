import { NextFunction, Request, Response } from 'express';

export interface ApiErrorPayload {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

const statusCodes: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'AUTHENTICATION_ERROR',
  403: 'AUTHORIZATION_ERROR',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMIT_ERROR',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export function errorCodeForStatus(statusCode: number): string {
  return statusCodes[statusCode] || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

export function formatApiError(
  message: string,
  statusCode = 500,
  code = errorCodeForStatus(statusCode),
  details?: Record<string, unknown>
): ApiErrorPayload {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details ? { details } : {}),
    },
  };
}

function normalizeBody(body: unknown, statusCode: number): unknown {
  if (statusCode < 400 || !body || typeof body !== 'object') {
    return body;
  }

  const value = body as Record<string, unknown>;
  const error = value.error;

  if (typeof error === 'string') {
    const details = typeof value.details === 'object' && value.details !== null
      ? value.details as Record<string, unknown>
      : undefined;
    return formatApiError(error, statusCode, errorCodeForStatus(statusCode), details);
  }

  if (error && typeof error === 'object') {
    const errorObject = error as Record<string, unknown>;
    const message = typeof errorObject.message === 'string' ? errorObject.message : 'Request failed';
    const code = typeof errorObject.code === 'string' ? errorObject.code : errorCodeForStatus(statusCode);
    const details = typeof errorObject.details === 'object' && errorObject.details !== null
      ? errorObject.details as Record<string, unknown>
      : undefined;
    return formatApiError(message, statusCode, code, details);
  }

  return body;
}

export function apiErrorSchema(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body?: unknown): Response => {
    return originalJson(normalizeBody(body, res.statusCode));
  };

  next();
}
