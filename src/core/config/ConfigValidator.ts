/** Central startup configuration validation and sanitized diagnostics. */
import { z } from 'zod';
import { logger } from '../observability/logger';
import {
  ENVIRONMENT_DEFINITIONS,
  ENVIRONMENT_DEFINITION_MAP,
  resolveDeploymentMode,
  RuntimeProfile
} from './EnvironmentDefinitions';

const emptyToUndefined = (value: unknown) => value === '' ? undefined : value;
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const booleanText = z.enum(['true', 'false']).optional();
const integerText = z.string().regex(/^\d+$/).transform(Number).optional();
const decimalText = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).optional();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEPLOYMENT_MODE: z.enum(['development', 'test', 'local', 'hosted']).optional(),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),
  BASE_URL: optionalUrl,
  STARTUP_TIMEOUT_MS: integerText,
  REQUEST_READY_TIMEOUT_MS: integerText,
  JWT_SECRET: z.string().min(32),
  CSRF_TOKEN: z.string().optional(),
  API_KEY_ENCRYPTION_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  CORS_CREDENTIALS: booleanText,
  TRUST_PROXY: z.string().optional(),
  LLM_PROVIDER: z.string().optional(),
  USE_OLLAMA: booleanText,
  OLLAMA_URL: optionalUrl,
  OLLAMA_BASE_URL: optionalUrl,
  OLLAMA_MODEL: z.string().optional(),
  USE_HUGGINGFACE: booleanText,
  HUGGINGFACE_MODEL: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  OPENAI_COMPATIBLE_BASE_URL: optionalUrl,
  OPENAI_COMPATIBLE_MODEL: z.string().optional(),
  OPENAI_COMPATIBLE_PROVIDER_NAME: z.string().optional(),
  LOCAL_MODEL_ENABLED: booleanText,
  LOCAL_MODEL_BASE_URL: optionalUrl,
  LOCAL_MODEL_PROVIDER_NAME: z.string().optional(),
  LOCAL_MODEL_NAME: z.string().optional(),
  LOCAL_MODEL_API_KEY: z.string().optional(),
  LOCAL_MODEL_ALLOWLIST: z.string().optional(),
  LOCAL_MODEL_MAX_CONCURRENCY: integerText,
  LOCAL_MODEL_MAX_QUEUE_DEPTH: integerText,
  LOCAL_MODEL_TIMEOUT_MS: integerText,
  LOCAL_MODEL_ROUTING_PRIVACY_MODE: z.enum(['strict_local', 'prefer_local', 'cloud_allowed', 'local_disabled']).optional(),
  CHATBOT_NATIVE_PYTHON: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
  FFMPEG_SHARED_DLL_DIR: z.string().optional(),
  DEMUCS_PATH: z.string().optional(),
  GODOT_PATH: z.string().optional(),
  UNITY_EDITOR_PATH: z.string().optional(),
  UNREAL_EDITOR_PATH: z.string().optional(),
  CF_ACCESSIBILITY_CERTIFIED: booleanText,
  CF_RELEASE_CERTIFIED: booleanText,
  CAPABILITY_ALERT_WEBHOOK_URL: optionalUrl,
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['openai', 'xenova', 'ollama']).optional(),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_USE_TRANSFORMERS: booleanText,
  USE_LLAVA: booleanText,
  LLAVA_MODEL: z.string().optional(),
  USE_GEMINI_VISION: booleanText,
  USE_GPT4V: booleanText,
  REDIS_URL: optionalUrl,
  DISK_CACHE_DIR: z.string().optional(),
  ENABLE_REDIS_CACHE: booleanText,
  ENABLE_DISK_CACHE: booleanText,
  KNOWLEDGE_BASE_DIR: z.string().optional(),
  RAG_GENERATE_EMBEDDINGS: booleanText,
  RAG_CHUNK_SIZE: integerText,
  RAG_PERSISTENCE: booleanText,
  RAG_SQLITE_PATH: z.string().optional(),
  RAG_DATABASE_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  RAG_RETRIEVAL_MODE: z.enum(['memory', 'database', 'hybrid']).optional(),
  GROUNDING_MODE: z.enum(['off', 'strict']).optional(),
  GROUNDING_REQUIRED_COVERAGE: decimalText,
  RERANKER_MODE: z.enum(['heuristic', 'llm', 'embedding', 'cross_encoder']).optional(),

  // Optional PyScrappy MCP research bridge
  PYSCRAPPY_ENABLED: z.string().optional(),
  PYSCRAPPY_MCP_COMMAND: z.string().optional(),
  PYSCRAPPY_MCP_ARGS: z.string().optional(),
  PYSCRAPPY_MCP_CWD: z.string().optional(),
  PYSCRAPPY_SCRAPE_TOOL: z.string().optional(),
  PYSCRAPPY_MAX_OUTPUT_BYTES: z.string().regex(/^\d+$/).optional(),

  ENABLE_RAG: booleanText,
  ENABLE_MODEL_ROUTING: booleanText,
  ENABLE_SAFETY_PIPELINE: booleanText,
  ENABLE_SEMANTIC_CACHE: booleanText,
  ENABLE_ENSEMBLE: booleanText,
  ENABLE_WEBSOCKET: booleanText,
  ENABLE_TOOL_CALLING: booleanText,
  ENABLE_BASH_EXECUTOR: booleanText,
  ENABLE_LOCAL_TOOLS: booleanText,
  LOCAL_EXECUTION_ENABLED: booleanText,
  ENABLE_FL_STUDIO_MCP: booleanText,
  RATE_LIMIT_WINDOW_MS: integerText,
  RATE_LIMIT_MAX_REQUESTS: integerText,
  SEMANTIC_CACHE_TTL: integerText,
  SEMANTIC_CACHE_SIMILARITY_THRESHOLD: decimalText,
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional()
}).passthrough();

export type ValidatedConfig = z.infer<typeof configSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config?: ValidatedConfig;
  profile?: RuntimeProfile;
}

export interface SanitizedConfigurationSummary {
  environment: string;
  deploymentMode: RuntimeProfile;
  port: number;
  corsOrigin: string | null;
  provider: string;
  configuredProviderCredentials: string[];
  database: 'postgresql' | 'sqlite' | 'memory-or-unspecified';
  redisConfigured: boolean;
  localExecutionEnabled: boolean;
  featureFlags: Record<string, boolean>;
}

function enabled(value: unknown): boolean {
  return value === 'true';
}

function isPlaceholderSecret(value: string): boolean {
  return /(?:change-me|replace-with|example|password|secret)/i.test(value);
}

function validateUrlPolicy(name: string, value: string | undefined, profile: RuntimeProfile, errors: string[]): void {
  if (!value) return;
  const url = new URL(value);
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname) || !url.hostname.includes('.');
  if (profile === 'hosted' && url.protocol !== 'https:' && !localHost) {
    errors.push(`${name}: hosted mode requires HTTPS for non-local endpoints`);
  }
  if (!['http:', 'https:', 'redis:', 'rediss:'].includes(url.protocol)) {
    errors.push(`${name}: unsupported URL scheme`);
  }
}

export class ConfigValidator {
  static validate(env: NodeJS.ProcessEnv = process.env): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const result = configSchema.safeParse(env);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${issue.path.join('.') || 'configuration'}: ${issue.message}`);
      return { valid: false, errors, warnings, profile: resolveDeploymentMode(env) };
    }

    const config = result.data;
    const profile = resolveDeploymentMode(env);
    this.validateDependencies(config, errors, warnings);
    this.validateProfile(config, profile, errors, warnings);
    this.validateDeprecatedVariables(env, warnings);

    return errors.length > 0
      ? { valid: false, errors, warnings, config, profile }
      : { valid: true, errors: [], warnings, config, profile };
  }

  private static validateDependencies(config: ValidatedConfig, errors: string[], warnings: string[]): void {
    if (enabled(config.USE_GEMINI_VISION) && !config.GEMINI_API_KEY) errors.push('GEMINI_API_KEY: required when USE_GEMINI_VISION=true');
    if (enabled(config.USE_GPT4V) && !config.OPENAI_API_KEY) errors.push('OPENAI_API_KEY: required when USE_GPT4V=true');
    if (config.EMBEDDING_PROVIDER === 'openai' && !config.OPENAI_API_KEY) errors.push('OPENAI_API_KEY: required for OpenAI embeddings');
    if (enabled(config.ENABLE_REDIS_CACHE) && !config.REDIS_URL) warnings.push('REDIS_URL: Redis cache is enabled without a URL');
  }

  private static validateProfile(config: ValidatedConfig, profile: RuntimeProfile, errors: string[], warnings: string[]): void {
    if (config.PORT < 1 || config.PORT > 65535) errors.push('PORT: must be between 1 and 65535');
    const localExecution = [config.ENABLE_BASH_EXECUTOR, config.ENABLE_LOCAL_TOOLS, config.LOCAL_EXECUTION_ENABLED, config.ENABLE_FL_STUDIO_MCP].some(enabled);
    if (profile === 'hosted') {
      if (isPlaceholderSecret(config.JWT_SECRET)) errors.push('JWT_SECRET: placeholder secrets are not allowed in hosted mode');
      if (!config.CORS_ORIGIN || config.CORS_ORIGIN === '*') errors.push('CORS_ORIGIN: hosted mode requires an explicit origin');
      if (config.CORS_ORIGIN?.includes(',')) warnings.push('CORS_ORIGIN: verify each configured origin is intentional');
      if (localExecution) errors.push('LOCAL_EXECUTION_ENABLED: hosted mode forbids local execution and desktop bridges');
      if (enabled(config.LOCAL_MODEL_ENABLED)) errors.push('LOCAL_MODEL_ENABLED: hosted mode forbids local model endpoints and process management');
      if (!config.API_KEY_ENCRYPTION_SECRET) warnings.push('API_KEY_ENCRYPTION_SECRET: required before persistent provider-key storage is production supported');
    }
    validateUrlPolicy('OLLAMA_URL', config.OLLAMA_URL, profile, errors);
    validateUrlPolicy('OPENAI_COMPATIBLE_BASE_URL', config.OPENAI_COMPATIBLE_BASE_URL, profile, errors);
    validateUrlPolicy('LOCAL_MODEL_BASE_URL', config.LOCAL_MODEL_BASE_URL, profile, errors);
    validateUrlPolicy('REDIS_URL', config.REDIS_URL, profile, errors);
  }

  private static validateDeprecatedVariables(env: NodeJS.ProcessEnv, warnings: string[]): void {
    for (const definition of ENVIRONMENT_DEFINITIONS) {
      if (definition.requirement === 'deprecated' && env[definition.name] !== undefined) {
        warnings.push(`${definition.name}: deprecated${definition.deprecatedBy ? `; use ${definition.deprecatedBy}` : ''}`);
      }
    }
  }

  static getValidatedConfig(env: NodeJS.ProcessEnv = process.env): ValidatedConfig {
    const result = this.validate(env);
    if (!result.valid || !result.config) {
      logger.error('Configuration validation failed', { errors: result.errors });
      throw new Error(`Configuration validation failed:\n${result.errors.join('\n')}`);
    }
    for (const warning of result.warnings) logger.warn('Configuration warning', { warning });
    logger.info('Configuration validated', { configuration: this.getSanitizedDiagnosticSummary(result.config, result.profile) });
    return result.config;
  }

  static getSanitizedDiagnosticSummary(
    config: ValidatedConfig = this.getValidatedConfig(),
    profile: RuntimeProfile = resolveDeploymentMode()
  ): SanitizedConfigurationSummary {
    const credentialNames = ['OPENAI_API_KEY', 'OPENAI_COMPATIBLE_API_KEY', 'LOCAL_MODEL_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'HUGGINGFACE_API_KEY']
      .filter(name => Boolean(config[name]));
    return {
      environment: config.NODE_ENV,
      deploymentMode: profile,
      port: config.PORT,
      corsOrigin: config.CORS_ORIGIN ?? null,
      provider: String(config.LLM_PROVIDER ?? (enabled(config.USE_OLLAMA) ? 'ollama' : enabled(config.LOCAL_MODEL_ENABLED) ? (config.LOCAL_MODEL_PROVIDER_NAME || 'local') : 'template')),
      configuredProviderCredentials: credentialNames,
      database: config.DATABASE_URL || config.RAG_DATABASE_URL ? 'postgresql' : config.RAG_SQLITE_PATH ? 'sqlite' : 'memory-or-unspecified',
      redisConfigured: Boolean(config.REDIS_URL),
      localExecutionEnabled: [config.ENABLE_BASH_EXECUTOR, config.ENABLE_LOCAL_TOOLS, config.LOCAL_EXECUTION_ENABLED, config.ENABLE_FL_STUDIO_MCP].some(enabled),
      featureFlags: Object.fromEntries(
        ENVIRONMENT_DEFINITION_MAP.size > 0
          ? ENVIRONMENT_DEFINITIONS.filter(item => item.category === 'features').map(item => [item.name, enabled(config[item.name])])
          : []
      )
    };
  }
}

export { resolveDeploymentMode } from './EnvironmentDefinitions';
