import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { APIKeyManager, LLM_PROVIDERS } from './APIKeyManager';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-PLAT-004 / RT-CONF-003: APIKeyManager Lifecycle and Encryption Suite', () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-key-manager-'));
    for (const provider of LLM_PROVIDERS) {
      delete process.env[provider.envVar];
    }
    delete process.env.API_KEY_ENCRYPTION_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires a strong encryption secret before storing API keys', async () => {
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    await expect(manager.setKey('openai', 'sk-test-secret')).rejects.toThrow('API_KEY_ENCRYPTION_SECRET');
  });

  it('stores keys encrypted and decrypts them with the configured secret', async () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'a'.repeat(32);
    const configPath = path.join(tempDir, 'keys.json');
    const manager = new APIKeyManager(configPath);
    await manager.initialize();

    await manager.setKey('openai', 'sk-test-secret');

    const stored = fs.readFileSync(configPath, 'utf8');
    expect(stored).not.toContain('sk-test-secret');
    expect(stored).toContain('v2:');
    expect(manager.getKey('openai')).toBe('sk-test-secret');
    expect(manager.hasKey('openai')).toBe(true);

    // List and remove
    expect(manager.getConfiguredProviders()).toContain('openai');
    await manager.removeKey('openai');
    expect(manager.hasKey('openai')).toBe(false);

    // Set key for unknown provider throws
    await expect(manager.setKey('unknown_provider', 'key')).rejects.toThrow('Unknown provider');
  });

  it('falls back to environment variable when key is not stored in keys map', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'a'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    process.env.ANTHROPIC_API_KEY = 'sk-ant-from-env';
    expect(manager.getKey('anthropic')).toBe('sk-ant-from-env');
    expect(manager.getKey('nonexistent_provider')).toBeUndefined();
  });

  it('handles legacy v1 decryption, corrupt file recovery, and invalid cipher detection', async () => {
    const secret = 'b'.repeat(32);
    process.env.API_KEY_ENCRYPTION_SECRET = secret;
    const configPath = path.join(tempDir, 'keys.json');

    // Create legacy CBC encrypted key (2 parts: iv:encrypted)
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secret).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update('legacy-openai-key', 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const legacyKey = `${iv.toString('hex')}:${encrypted}`;

    fs.writeFileSync(configPath, JSON.stringify({
      openai: {
        provider: 'openai',
        key: legacyKey,
        addedAt: new Date().toISOString()
      }
    }, null, 2));

    const manager = new APIKeyManager(configPath);
    await manager.initialize();
    expect(manager.getKey('openai')).toBe('legacy-openai-key');

    // Test corrupted unencrypted string format
    expect(() => (manager as any).decrypt('invalid_unencrypted_key')).toThrow('Stored API key is not encrypted');

    // Test corrupt JSON file handling during load
    delete process.env.OPENAI_API_KEY;
    fs.writeFileSync(configPath, '{ invalid json');
    const corruptManager = new APIKeyManager(configPath);
    await corruptManager.initialize();
    expect(corruptManager.getConfiguredProviders()).toEqual([]);
  });

  it('imports keys from environment content', async () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'c'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    const envContent = `
# Comment line
OPENAI_API_KEY=sk-imported-openai-12345
GROQ_API_KEY=gsk_imported_groq_67890
UNKNOWN_VAR=test
`;
    const count = await manager.importFromEnv(envContent);
    expect(count).toBe(2);
    expect(manager.getKey('openai')).toBe('sk-imported-openai-12345');
    expect(manager.getKey('groq')).toBe('gsk_imported_groq_67890');
  });

  it('provides setup wizard, stats, and setup guides', async () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'd'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    const wizard = manager.getSetupWizard('groq');
    expect(wizard?.provider.name).toBe('Groq');
    expect(wizard?.hasKey).toBe(false);
    expect(manager.getSetupWizard('unknown_provider')).toBeNull();

    const guide = manager.generateSetupGuide();
    expect(guide).toContain('LLM API Key Setup Guide');
    expect(guide).toContain('Groq');

    // Free provider stats
    await manager.setKey('cerebras', 'sk-cerebras');
    await manager.setKey('openai', 'sk-openai');
    const stats = manager.getStats();
    expect(stats.totalProviders).toBe(LLM_PROVIDERS.length);
    expect(stats.configuredProviders).toBe(2);
    expect(stats.freeProviders).toBe(1);
    expect(stats.paidProviders).toBe(1);
  });

  it('does not export plaintext environment files', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'e'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    expect(() => manager.exportToEnv()).toThrow('Plaintext API key export is disabled');
  });

  it('validates provider keys across all supported provider endpoints and updates stored status', async () => {
    (mockedAxios.get as any).mockResolvedValue({ data: { models: [] } });

    process.env.API_KEY_ENCRYPTION_SECRET = 'f'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    // Validate without key
    const noKey = await manager.validateKey('openai');
    expect(noKey.valid).toBe(false);
    expect(noKey.error).toBe('No API key provided');

    // Validate with stored key and update isValid flag
    await manager.setKey('openai', 'sk-stored-openai');
    const storedValid = await manager.validateKey('openai');
    expect(storedValid.valid).toBe(true);

    // Validate groq
    const groqValid = await manager.validateKey('groq', 'gsk_test123');
    expect(groqValid.valid).toBe(true);

    // Validate gemini
    const geminiValid = await manager.validateKey('gemini', 'AIzaSy_test');
    expect(geminiValid.valid).toBe(true);

    // Validate cohere
    const cohereValid = await manager.validateKey('cohere', 'cohere_key_123');
    expect(cohereValid.valid).toBe(true);

    // Validate deepseek
    const deepseekValid = await manager.validateKey('deepseek', 'sk-deepseek-123');
    expect(deepseekValid.valid).toBe(true);

    // Validate ollama
    const ollamaValid = await manager.validateKey('ollama', 'http://localhost:11434');
    expect(ollamaValid.valid).toBe(true);

    // Validate default/unknown provider (auto-valid)
    const customValid = await manager.validateKey('custom_provider', 'any_key');
    expect(customValid.valid).toBe(true);

    // Test API error response
    (mockedAxios.get as any).mockRejectedValueOnce({
      response: { data: { error: { message: 'Invalid API key credentials' } } }
    });
    const failedValid = await manager.validateKey('groq', 'bad_key');
    expect(failedValid.valid).toBe(false);
    expect(failedValid.error).toBe('Invalid API key credentials');

    // Test network error response
    (mockedAxios.get as any).mockRejectedValueOnce(new Error('Network timeout'));
    const netFailed = await manager.validateKey('groq', 'bad_key');
    expect(netFailed.valid).toBe(false);
    expect(netFailed.error).toBe('Network timeout');
  });
});
