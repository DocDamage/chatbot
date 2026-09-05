import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { APIKeyManager, LLM_PROVIDERS } from '../APIKeyManager';

jest.mock('axios', () => {
  const getFn = jest.fn(async (url: string, config?: any) => {
    const authHeader = config?.headers?.Authorization || '';
    if (authHeader.includes('invalid') || url.includes('invalid')) {
      const error = new Error('Request failed with status code 401');
      (error as any).response = { data: { error: { message: 'Invalid API key provided' } } };
      throw error;
    }
    return { data: { models: [] } };
  });

  return {
    __esModule: true,
    default: {
      get: getFn
    },
    get: getFn
  };
});

describe('RT-PLAT-004 / RT-CONF-001: APIKeyManager Encryption and Lifecycle Suite', () => {
  let tempDir: string;
  let configPath: string;
  const validSecret = 'a-very-secure-encryption-secret-of-32-bytes!';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-key-test-'));
    configPath = path.join(tempDir, 'api_keys.json');
    process.env.API_KEY_ENCRYPTION_SECRET = validSecret;
  });

  afterEach(() => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('rejects encryption when secret is missing, too short, or default', async () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'short';
    const manager = new APIKeyManager(configPath);
    await expect(manager.setKey('groq', 'gsk-12345')).rejects.toThrow('API_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters');

    process.env.API_KEY_ENCRYPTION_SECRET = 'default-key-change-me';
    const defaultManager = new APIKeyManager(configPath);
    await expect(defaultManager.setKey('groq', 'gsk-12345')).rejects.toThrow('API_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters');
  });

  it('encrypts, persists, decrypts, and reloads stored keys', async () => {
    const manager = new APIKeyManager(configPath);
    await manager.initialize();

    expect(manager.hasKey('groq')).toBe(false);
    expect(manager.getKey('groq')).toBeUndefined();

    // Set key
    await manager.setKey('groq', 'gsk-secret-key-123', 'llama-3.3-70b-versatile');
    expect(manager.hasKey('groq')).toBe(true);
    expect(manager.getKey('groq')).toBe('gsk-secret-key-123');
    expect(process.env.GROQ_API_KEY).toBe('gsk-secret-key-123');

    // Verify raw file content is encrypted with v2 format
    const rawContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(rawContent.groq.key).toMatch(/^v2:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);

    // Reload into a new manager instance
    const newManager = new APIKeyManager(configPath);
    await newManager.initialize();
    expect(newManager.hasKey('groq')).toBe(true);
    expect(newManager.getKey('groq')).toBe('gsk-secret-key-123');

    // Remove key
    const removed = await newManager.removeKey('groq');
    expect(removed).toBe(true);
    expect(newManager.hasKey('groq')).toBe(false);
  });

  it('decrypts legacy v1 CBC encrypted keys', async () => {
    const key = crypto.createHash('sha256').update(validSecret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update('legacy-secret-key', 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const legacyFormat = `${iv.toString('hex')}:${encrypted}`;

    fs.writeFileSync(configPath, JSON.stringify({
      gemini: {
        provider: 'gemini',
        key: legacyFormat,
        addedAt: new Date().toISOString()
      }
    }));

    const manager = new APIKeyManager(configPath);
    await manager.initialize();
    expect(manager.getKey('gemini')).toBe('legacy-secret-key');
  });

  it('validates provider keys via mocked HTTP endpoints', async () => {
    const manager = new APIKeyManager(configPath);
    await manager.setKey('groq', 'valid-key');
    const validRes = await manager.validateKey('groq');
    expect(validRes.valid).toBe(true);

    const invalidRes = await manager.validateKey('groq', 'invalid-key');
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.error).toContain('Invalid API key provided');

    // Unknown/unsupported validation defaults to valid
    const customRes = await manager.validateKey('unknown-provider', 'any-key');
    expect(customRes.valid).toBe(true);

    // Missing key error
    const missingRes = await manager.validateKey('openai');
    expect(missingRes.valid).toBe(false);
    expect(missingRes.error).toBe('No API key provided');
  });

  it('provides directory listings, setup wizards, guides, stats, and import capabilities', async () => {
    const manager = new APIKeyManager(configPath);
    expect(manager.getAllProviders().length).toBe(LLM_PROVIDERS.length);
    expect(manager.getFreeProviders().length).toBeGreaterThan(0);
    expect(manager.getProviderInfo('groq')?.name).toBe('Groq');

    const wizard = manager.getSetupWizard('gemini');
    expect(wizard).not.toBeNull();
    expect(wizard?.provider.id).toBe('gemini');
    expect(manager.getSetupWizard('non-existent')).toBeNull();

    const guide = manager.generateSetupGuide();
    expect(guide).toContain('# 🔑 LLM API Key Setup Guide');

    // Import from .env
    const envContent = 'GROQ_API_KEY=gsk-imported-123\nGEMINI_API_KEY=gemini-imported-456\nUNRELATED_VAR=value';
    const importedCount = await manager.importFromEnv(envContent);
    expect(importedCount).toBe(2);
    expect(manager.getKey('groq')).toBe('gsk-imported-123');
    expect(manager.getKey('gemini')).toBe('gemini-imported-456');

    const stats = manager.getStats();
    expect(stats.configuredProviders).toBe(2);
    expect(stats.totalProviders).toBe(LLM_PROVIDERS.length);

    // Plaintext export is explicitly disabled for security
    expect(() => manager.exportToEnv()).toThrow('Plaintext API key export is disabled');
  });
});
