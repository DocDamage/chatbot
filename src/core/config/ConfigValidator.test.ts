jest.mock('../observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { ConfigValidator } from './ConfigValidator';

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
});
