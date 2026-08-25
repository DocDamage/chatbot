jest.mock('../observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { ConfigValidator } from './ConfigValidator';
import { logger } from '../observability/logger';

const base = {
  NODE_ENV: 'development',
  DEPLOYMENT_MODE: 'development',
  PORT: '3001',
  JWT_SECRET: 'a-secure-development-secret-with-32-chars',
  CORS_ORIGIN: 'http://localhost:3000'
};

describe('ConfigValidator', () => {
  it('accepts a safe local development profile', () => {
    const result = ConfigValidator.validate({ ...base, DEPLOYMENT_MODE: 'local', ENABLE_LOCAL_TOOLS: 'true' });
    expect(result.valid).toBe(true);
    expect(result.profile).toBe('local');
  });

  it('rejects wildcard CORS and local execution in hosted mode', () => {
    const result = ConfigValidator.validate({
      ...base,
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'hosted',
      JWT_SECRET: 'a-production-secret-that-is-long-enough',
      CORS_ORIGIN: '*',
      ENABLE_LOCAL_TOOLS: 'true'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('CORS_ORIGIN'),
      expect.stringContaining('hosted mode forbids local execution')
    ]));
  });

  it('rejects placeholder secrets in hosted mode without leaking values', () => {
    const secret = 'replace-with-at-least-32-random-characters';
    const result = ConfigValidator.validate({ ...base, NODE_ENV: 'production', DEPLOYMENT_MODE: 'hosted', JWT_SECRET: secret });
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).not.toContain(secret);
  });

  it('returns a sanitized diagnostic summary', () => {
    const result = ConfigValidator.validate({ ...base, OPENAI_API_KEY: 'sk-private-value', LLM_PROVIDER: 'openai' });
    expect(result.valid).toBe(true);
    const summary = ConfigValidator.getSanitizedDiagnosticSummary(result.config!, result.profile);
    expect(summary.configuredProviderCredentials).toEqual(['OPENAI_API_KEY']);
    expect(JSON.stringify(summary)).not.toContain('sk-private-value');
  });

  it('returns schema diagnostics for malformed values and empty optional URLs', () => {
    const invalid = ConfigValidator.validate({ ...base, PORT: 'not-a-port', JWT_SECRET: 'short' });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(' ')).toContain('PORT');
    expect(invalid.errors.join(' ')).toContain('JWT_SECRET');

    const emptyUrl = ConfigValidator.validate({ ...base, BASE_URL: '', REDIS_URL: '' });
    expect(emptyUrl.valid).toBe(true);
    expect(emptyUrl.config?.BASE_URL).toBeUndefined();
  });

  it('validates provider dependencies and Redis warnings', () => {
    const result = ConfigValidator.validate({
      ...base,
      USE_GEMINI_VISION: 'true',
      USE_GPT4V: 'true',
      EMBEDDING_PROVIDER: 'openai',
      ENABLE_REDIS_CACHE: 'true'
    });
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('GEMINI_API_KEY'),
      expect.stringContaining('USE_GPT4V'),
      expect.stringContaining('OpenAI embeddings')
    ]));
    expect(result.warnings).toEqual([expect.stringContaining('REDIS_URL')]);
  });

  it('enforces port, hosted endpoint, local-model, and encryption-key policies', () => {
    const result = ConfigValidator.validate({
      ...base,
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'hosted',
      PORT: '70000',
      JWT_SECRET: 'z9R8m7Q6v5P4n3K2j1H0g9F8d7S6a5W4',
      CORS_ORIGIN: 'https://one.example,https://two.example',
      LOCAL_MODEL_ENABLED: 'true',
      OLLAMA_URL: 'http://models.example/v1',
      OPENAI_COMPATIBLE_BASE_URL: 'ftp://models.example/v1'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('PORT'),
      expect.stringContaining('LOCAL_MODEL_ENABLED'),
      expect.stringContaining('requires HTTPS'),
      expect.stringContaining('unsupported URL scheme')
    ]));
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('verify each configured origin'),
      expect.stringContaining('API_KEY_ENCRYPTION_SECRET')
    ]));
  });

  it('allows hosted loopback URLs and emits deprecated-variable warnings', () => {
    const result = ConfigValidator.validate({
      ...base,
      NODE_ENV: 'production',
      DEPLOYMENT_MODE: 'hosted',
      JWT_SECRET: 'z9R8m7Q6v5P4n3K2j1H0g9F8d7S6a5W4',
      CORS_ORIGIN: 'https://app.example',
      API_KEY_ENCRYPTION_SECRET: 'configured',
      OLLAMA_URL: 'http://127.0.0.1:11434',
      MODEL_ROUTING_ENABLED: 'true'
    });
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([expect.stringContaining('use ENABLE_MODEL_ROUTING')]);
  });

  it('throws from getValidatedConfig and logs warnings on a valid config', () => {
    expect(() => ConfigValidator.getValidatedConfig({ ...base, JWT_SECRET: 'short' })).toThrow('Configuration validation failed');
    const config = ConfigValidator.getValidatedConfig({ ...base, ENABLE_REDIS_CACHE: 'true' });
    expect(config.PORT).toBe(3001);
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it('summarizes provider, storage, credentials, and local execution branches', () => {
    const ollama = ConfigValidator.validate({
      ...base,
      CORS_ORIGIN: undefined,
      USE_OLLAMA: 'true',
      DATABASE_URL: 'postgres://db',
      REDIS_URL: 'redis://localhost:6379',
      ENABLE_BASH_EXECUTOR: 'true',
      ANTHROPIC_API_KEY: 'a',
      GEMINI_API_KEY: 'b',
      HUGGINGFACE_API_KEY: 'c'
    });
    expect(ConfigValidator.getSanitizedDiagnosticSummary(ollama.config!, ollama.profile)).toMatchObject({
      corsOrigin: null,
      provider: 'ollama',
      database: 'postgresql',
      redisConfigured: true,
      localExecutionEnabled: true,
      configuredProviderCredentials: ['ANTHROPIC_API_KEY', 'GEMINI_API_KEY', 'HUGGINGFACE_API_KEY']
    });

    const local = ConfigValidator.validate({
      ...base, LOCAL_MODEL_ENABLED: 'true', LOCAL_MODEL_PROVIDER_NAME: '', RAG_SQLITE_PATH: 'rag.sqlite'
    });
    expect(ConfigValidator.getSanitizedDiagnosticSummary(local.config!, local.profile)).toMatchObject({
      provider: 'local', database: 'sqlite'
    });
  });
});
