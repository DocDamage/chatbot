import fs from 'fs';
import os from 'os';
import path from 'path';
import { ServiceInitializer, InitializationStatus } from './ServiceInitializer';

describe('ServiceInitializer optional startup work', () => {
  const originalKnowledgeBaseDir = process.env.KNOWLEDGE_BASE_DIR;

  afterEach(() => {
    if (originalKnowledgeBaseDir === undefined) {
      delete process.env.KNOWLEDGE_BASE_DIR;
    } else {
      process.env.KNOWLEDGE_BASE_DIR = originalKnowledgeBaseDir;
    }
  });

  it('does not create placeholder knowledge-base files during startup', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-kb-'));
    const missingKb = path.join(root, 'knowledge-base');
    process.env.KNOWLEDGE_BASE_DIR = missingKb;
    const documentManager = { addDirectory: jest.fn() };

    await (ServiceInitializer as any).loadKnowledgeBase(documentManager);

    expect(fs.existsSync(missingKb)).toBe(false);
    expect(documentManager.addDirectory).not.toHaveBeenCalled();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('tracks optional initialization success and failure without throwing', async () => {
    const initialization: InitializationStatus = {
      criticalStartedAt: new Date().toISOString(),
      optional: {
        success: { status: 'pending' },
        failure: { status: 'pending' }
      }
    };

    await (ServiceInitializer as any).trackOptionalInitialization(initialization, 'success', async () => {});
    await (ServiceInitializer as any).trackOptionalInitialization(initialization, 'failure', async () => {
      throw new Error('background load failed');
    });

    expect(initialization.optional.success.status).toBe('ready');
    expect(initialization.optional.failure.status).toBe('failed');
    expect(initialization.optional.failure.error).toBe('background load failed');
  });
});
