import fs from 'fs';
import os from 'os';
import path from 'path';
import { APIKeyManager, LLM_PROVIDERS } from './APIKeyManager';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RT-PLAT-004 / RT-CONF-003: APIKeyManager Lifecycle and Encryption Suite', () => {
  const originalSecret = process.env.API_KEY_ENCRYPTION_SECRET;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-key-manager-'));
    delete process.env.API_KEY_ENCRYPTION_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.API_KEY_ENCRYPTION_SECRET;
    } else {
      process.env.API_KEY_ENCRYPTION_SECRET = originalSecret;
    }
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

    await manager.setKey('openai', 'sk-test-secret');

    const stored = fs.readFileSync(configPath, 'utf8');
    expect(stored).not.toContain('sk-test-secret');
    expect(stored).toContain('v2:');
    expect(manager.getKey('openai')).toBe('sk-test-secret');
    expect(manager.hasKey('openai')).toBe(true);

    // List and remove
    expect(manager.getConfiguredProviders()).toContain('openai');
    manager.removeKey('openai');
    expect(manager.hasKey('openai')).toBe(false);
  });

  it('does not export plaintext environment files', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'b'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    expect(() => manager.exportToEnv()).toThrow('Plaintext API key export is disabled');
  });

  it('provides provider catalog and free provider list', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'c'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    expect(manager.getAllProviders().length).toBe(LLM_PROVIDERS.length);
    const free = manager.getFreeProviders();
    expect(free.length).toBeGreaterThan(0);
  });

  it('validates provider key format heuristics and endpoints', async () => {
    (mockedAxios.get as any).mockResolvedValue({ data: { models: [] } });

    process.env.API_KEY_ENCRYPTION_SECRET = 'd'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    const groqValid = await manager.validateKey('groq', 'gsk_test123456789012345678901234567890123456789012345678');
    expect(groqValid.valid).toBe(true);
  });
});
