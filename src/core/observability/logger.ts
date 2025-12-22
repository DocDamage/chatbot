/**
 * Observability - Structured logging with file transport and rotation
 */

import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

// Ensure logs directory exists
const logsDir = process.env.LOGS_DIR || 'logs';
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch {
  // Directory creation failed, will use console only
}

// Custom format for better readability
const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
});

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-chatbot-hub' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        customFormat
      )
    })
  ]
});

// Add file transports in production or when ENABLE_FILE_LOGGING is set
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  // Error log - only errors
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  // Combined log - all levels
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  // Daily rotating file for archival
  // Note: Requires winston-daily-rotate-file package for full rotation
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`),
    maxsize: 100 * 1024 * 1024, // 100MB
    maxFiles: 30,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));

  logger.info('File logging enabled', { logsDir });
}

// Performance logging helper
export function logPerformance(operation: string, startTime: number, metadata?: Record<string, any>): void {
  const duration = Date.now() - startTime;
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';

  logger.log(level, `${operation} completed`, {
    duration: `${duration}ms`,
    ...metadata
  });
}

// Request logging helper
export function logRequest(req: {
  method: string;
  path: string;
  userId?: string;
  ip?: string;
}, duration: number, status: number): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  logger.log(level, 'HTTP Request', {
    method: req.method,
    path: req.path,
    status,
    duration: `${duration}ms`,
    userId: req.userId,
    ip: req.ip
  });
}

// Error logging helper with context
export function logError(error: Error, context?: Record<string, any>): void {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
}

// Audit logging for security-sensitive operations
export function logAudit(action: string, userId: string, details: Record<string, any>): void {
  logger.info(`AUDIT: ${action}`, {
    audit: true,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
}

// Child logger for specific components
export function createChildLogger(component: string): winston.Logger {
  return logger.child({ component });
}

export default logger;
