/**
 * Configuration Validator - Validate all environment variables on startup
 */

import { z } from 'zod';
import { logger } from '../observability/logger';

// Configuration schema
const configSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),

  // LLM Providers
  USE_OLLAMA: z.string().optional(),
  OLLAMA_URL: z.string().url().optional(),
  OLLAMA_MODEL: z.string().optional(),
  USE_HUGGINGFACE: z.string().optional(),
  HUGGINGFACE_MODEL: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  // Embeddings
  EMBEDDING_PROVIDER: z.enum(['openai', 'xenova', 'ollama']).optional(),
  EMBEDDING_MODEL: z.string().optional(),

  // Vision
  USE_LLAVA: z.string().optional(),
  LLAVA_MODEL: z.string().optional(),
  USE_GEMINI_VISION: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  USE_GPT4V: z.string().optional(),

  // Cache
  REDIS_URL: z.string().url().optional(),
  DISK_CACHE_DIR: z.string().optional(),
  ENABLE_REDIS_CACHE: z.string().optional(),
  ENABLE_DISK_CACHE: z.string().optional(),

  // RAG
  KNOWLEDGE_BASE_DIR: z.string().optional(),
  RAG_GENERATE_EMBEDDINGS: z.string().optional(),
  RAG_CHUNK_SIZE: z.string().regex(/^\d+$/).transform(Number).optional(),

  // Features
  ENABLE_RAG: z.string().optional(),
  ENABLE_MODEL_ROUTING: z.string().optional(),
  ENABLE_SAFETY_PIPELINE: z.string().optional(),
  ENABLE_SEMANTIC_CACHE: z.string().optional(),
  ENABLE_ENSEMBLE: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).transform(Number).optional(),

  // Semantic Cache
  SEMANTIC_CACHE_TTL: z.string().regex(/^\d+$/).transform(Number).optional(),
  SEMANTIC_CACHE_SIMILARITY_THRESHOLD: z.string().regex(/^\d+\.?\d*$/).transform(Number).optional(),

  // Auth
  JWT_SECRET: z.string().min(32).optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
});

export type ValidatedConfig = z.infer<typeof configSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: ValidatedConfig;
}

export class ConfigValidator {
  /**
   * Validate all configuration
   */
  static validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate against schema
      const result = configSchema.safeParse(process.env);

      if (!result.success) {
        result.error.errors.forEach(err => {
          errors.push(`${err.path.join('.')}: ${err.message}`);
        });
        return { valid: false, errors, warnings };
      }

      const config = result.data;

      // Additional validation checks
      this.validateDependencies(config, errors, warnings);
      this.validateProduction(config, errors, warnings);

      if (errors.length > 0) {
        return { valid: false, errors, warnings };
      }

      logger.info('Configuration validated successfully', {
        warnings: warnings.length,
      });

      return {
        valid: true,
        errors: [],
        warnings,
        config,
      };
    } catch (error: any) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate feature dependencies
   */
  private static validateDependencies(
    config: ValidatedConfig,
    errors: string[],
    warnings: string[]
  ): void {
    // Check if required API keys are present for enabled features
    if (config.USE_GEMINI_VISION === 'true' && !config.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY required when USE_GEMINI_VISION is enabled');
    }

    if (config.USE_GPT4V === 'true' && !config.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY required when USE_GPT4V is enabled');
    }

    if (config.EMBEDDING_PROVIDER === 'openai' && !config.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY required when EMBEDDING_PROVIDER is openai');
    }

    // Warnings for missing optional features
    if (config.ENABLE_REDIS_CACHE === 'true' && !config.REDIS_URL) {
      warnings.push('REDIS_URL not set, Redis cache will not be available');
    }

    if (config.USE_OLLAMA !== 'false' && !config.OLLAMA_URL) {
      warnings.push('OLLAMA_URL not set, using default http://localhost:11434');
    }
  }

  /**
   * Validate production-specific requirements
   */
  private static validateProduction(
    config: ValidatedConfig,
    errors: string[],
    warnings: string[]
  ): void {
    if (config.NODE_ENV === 'production') {
      // Production requires JWT secret
      if (!config.JWT_SECRET || config.JWT_SECRET === 'change-me-in-production') {
        errors.push('JWT_SECRET must be set in production (minimum 32 characters)');
      }

      // Warn about insecure defaults
      if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
        warnings.push('JWT_SECRET should be at least 32 characters for security');
      }

      // Warn if using default ports
      if (config.PORT === 3001) {
        warnings.push('Using default port 3001 in production');
      }
    }
  }

  /**
   * Get validated config or throw
   */
  static getValidatedConfig(): ValidatedConfig {
    const result = this.validate();

    if (!result.valid) {
      logger.error('Configuration validation failed', { errors: result.errors });
      throw new Error(`Configuration validation failed:\n${result.errors.join('\n')}`);
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => logger.warn('Configuration warning', { warning }));
    }

    return result.config!;
  }
}

