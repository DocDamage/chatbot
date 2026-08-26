import { describe, expect, it } from '@jest/globals';
import { ConfigValidator } from '../ConfigValidator';

describe('RT-PLAT-001 / RT-CONF-004: ConfigValidator Deployment Rules and Diagnostics Suite', () => {
  const baseValidEnv: NodeJS.ProcessEnv = {
    NODE_ENV: 'development',
    PORT: '3001',
    JWT_SECRET: 'super-secure-jwt-secret-key-32-chars-long'
  };

  it('validates a minimal valid development configuration', () => {
    const result = ConfigValidator.validate(baseValidEnv);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.config?.PORT).toBe(3001);
  });

  it('catches missing or short JWT_SECRET and invalid numeric ports', () => {
    const resultMissingJwt = ConfigValidator.validate({
      ...baseValidEnv,
      JWT_SECRET: 'too-short'
    });
    expect(resultMissingJwt.valid).toBe(false);
    expect(resultMissingJwt.errors[0]).toContain('JWT_SECRET');

    const resultInvalidPort = ConfigValidator.validate({
      ...baseValidEnv,
      PORT: '70000'
    });
    expect(resultInvalidPort.valid).toBe(false);
    expect(resultInvalidPort.errors[0]).toContain('PORT');
  });

  it('enforces dependency validation for vision and embedding providers', () => {
    const resultGeminiVision = ConfigValidator.validate({
      ...baseValidEnv,
      USE_GEMINI_VISION: 'true'
    });
    expect(resultGeminiVision.valid).toBe(false);
    expect(resultGeminiVision.errors).toContain('GEMINI_API_KEY: required when USE_GEMINI_VISION=true');

    const resultGpt4v = ConfigValidator.validate({
      ...baseValidEnv,
      USE_GPT4V: 'true'
    });
    expect(resultGpt4v.valid).toBe(false);
    expect(resultGpt4v.errors).toContain('OPENAI_API_KEY: required when USE_GPT4V=true');

    const resultOpenAiEmbedding = ConfigValidator.validate({
      ...baseValidEnv,
      EMBEDDING_PROVIDER: 'openai'
    });
    expect(resultOpenAiEmbedding.valid).toBe(false);
    expect(resultOpenAiEmbedding.errors).toContain('OPENAI_API_KEY: required for OpenAI embeddings');

    const resultRedisWarning = ConfigValidator.validate({
      ...baseValidEnv,
      ENABLE_REDIS_CACHE: 'true'
    });
    expect(resultRedisWarning.valid).toBe(true);
    expect(resultRedisWarning.warnings).toContain('REDIS_URL: Redis cache is enabled without a URL');
  });

  it('enforces hosted mode restrictions (placeholder secret, wildcards, local execution, HTTP URLs)', () => {
    const hostedEnv: NodeJS.ProcessEnv = {
      ...baseValidEnv,
      DEPLOYMENT_MODE: 'hosted',
      JWT_SECRET: 'change-me-placeholder-secret-long-enough',
      CORS_ORIGIN: '*',
      LOCAL_EXECUTION_ENABLED: 'true',
      LOCAL_MODEL_ENABLED: 'true',
      OLLAMA_URL: 'http://remote-server.com/api'
    };

    const result = ConfigValidator.validate(hostedEnv);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('placeholder secrets'))).toBe(true);
    expect(result.errors.some(e => e.includes('hosted mode requires an explicit origin'))).toBe(true);
    expect(result.errors.some(e => e.includes('hosted mode forbids local execution'))).toBe(true);
    expect(result.errors.some(e => e.includes('hosted mode forbids local model endpoints'))).toBe(true);
    expect(result.errors.some(e => e.includes('hosted mode requires HTTPS'))).toBe(true);
  });

  it('produces sanitized diagnostic summaries with database and provider classifications', () => {
    const configWithPostgres = ConfigValidator.getValidatedConfig({
      ...baseValidEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/chatbot',
      OPENAI_API_KEY: 'sk-test-secret',
      ENABLE_LOCAL_TOOLS: 'true'
    });

    const summary = ConfigValidator.getSanitizedDiagnosticSummary(configWithPostgres, 'local');
    expect(summary.database).toBe('postgresql');
    expect(summary.configuredProviderCredentials).toEqual(['OPENAI_API_KEY']);
    expect(summary.localExecutionEnabled).toBe(true);

    const configWithSqlite = ConfigValidator.getValidatedConfig({
      ...baseValidEnv,
      RAG_SQLITE_PATH: './data/rag.db'
    });
    const summarySqlite = ConfigValidator.getSanitizedDiagnosticSummary(configWithSqlite, 'development');
    expect(summarySqlite.database).toBe('sqlite');
  });

  it('throws in getValidatedConfig when config is invalid', () => {
    expect(() => ConfigValidator.getValidatedConfig({ PORT: 'bad' })).toThrow('Configuration validation failed');
  });
});
