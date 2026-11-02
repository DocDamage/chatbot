import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelegramSource } from '../TelegramSource';

describe('B75-08: TelegramSource Ingestion Matrix', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-source-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('loads single telegram json export with metadata and embeddings', async () => {
    const sampleExport = {
      chats: {
        list: [
          {
            name: 'Dev Channel',
            type: 'channel',
            messages: [
              { id: 1, date: '2025-01-10T10:00:00Z', from: 'Alice', text: 'Hello team', type: 'message' },
              { id: 2, date: '2025-01-10T10:01:00Z', from: 'Bob', text: 'Deploying update', type: 'message' },
              { id: 3, date: '2025-01-10T10:02:00Z', text: 'System notification', type: 'service' }
            ]
          }
        ]
      }
    };

    const filePath = path.join(tempDir, 'export.json');
    fs.writeFileSync(filePath, JSON.stringify(sampleExport, null, 2), 'utf8');

    const mockEmbeddingService: any = {
      embed: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };

    const source = new TelegramSource(mockEmbeddingService);
    const chunks = await source.loadTelegramExport(filePath, {
      generateEmbeddings: true,
      chunkSize: 2,
      includeMetadata: true
    });

    expect(chunks.length).toBe(2);
    expect(chunks[0].id).toContain('telegram_Dev Channel_chunk_0');
    expect(chunks[0].embedding).toEqual([0.1, 0.2, 0.3]);
    expect(chunks[0].content).toContain('Alice: Hello team');
    expect(chunks[0].metadata.chatType).toBe('channel');
  });

  it('loads directory of telegram export files and handles invalid json files', async () => {
    const validExport = {
      chats: {
        list: [
          {
            name: 'General Chat',
            messages: [
              { id: 1, date: '2025-01-01T00:00:00Z', text: 'Welcome', type: 'message' }
            ]
          }
        ]
      }
    };

    fs.writeFileSync(path.join(tempDir, 'chat1.json'), JSON.stringify(validExport), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'invalid.json'), 'invalid json string', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'ignore.txt'), 'text file', 'utf8');

    const source = new TelegramSource();
    const allChunks = await source.loadTelegramDirectory(tempDir, { includeMetadata: false } as any);

    expect(allChunks.length).toBe(1);
    expect(allChunks[0].content).toBe('Welcome');
  });
});
