import fs from 'fs';
import os from 'os';
import path from 'path';
import { APIKeyManager } from './APIKeyManager';

describe('APIKeyManager', () => {
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
  });

  it('does not export plaintext environment files', () => {
    process.env.API_KEY_ENCRYPTION_SECRET = 'b'.repeat(32);
    const manager = new APIKeyManager(path.join(tempDir, 'keys.json'));

    expect(() => manager.exportToEnv()).toThrow('Plaintext API key export is disabled');
  });
});
