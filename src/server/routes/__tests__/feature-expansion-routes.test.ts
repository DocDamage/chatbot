import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createAudioRouter } from '../audio';
import { createFilesRouter } from '../files';
import { createGamingRouter } from '../gaming';
import { createKnowledgeOnlineRouter } from '../knowledge-online';
import { createPlansRouter } from '../plans';

jest.mock('../../../core/tools/WebSearcher', () => ({
  WebSearcher: {
    fromEnv: jest.fn(() => ({
      search: jest.fn().mockResolvedValue({
        success: true,
        data: {
          results: [{
            title: 'Godot docs',
            url: 'https://example.com/godot',
            snippet: 'Godot has editor and rendering improvements.'
          }]
        }
      })
    }))
  }
}));

describe('feature expansion routes', () => {
  it('creates, lists, reads, and loads saved Markdown plans', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-route-'));
    const app = express();
    app.use(express.json());
    app.use(createPlansRouter(root));

    const created = await request(app)
      .post('/api/plans')
      .send({ userRequest: 'Add route tests' })
      .expect(200);

    expect(created.body.savedMarkdown).toBe(true);
    expect(fs.existsSync(path.join(root, created.body.planPath))).toBe(true);

    await request(app).get('/api/plans').expect(200).expect(response => {
      expect(response.body.plans[0].planId).toBe(created.body.planId);
    });
    await request(app).get(`/api/plans/${created.body.planId}`).expect(200);
    await request(app).post(`/api/plans/${created.body.planId}/load`).expect(200).expect(response => {
      expect(response.body.loaded).toBe(true);
    });
  });

  it('serves file tree, search, read, metadata, and load endpoints safely', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'files-route-'));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'export const routeValue = 7;\n');
    fs.writeFileSync(path.join(root, '.env'), 'SECRET=value\n');
    const app = express();
    app.use(express.json());
    app.use(createFilesRouter(root));

    await request(app).get('/api/files/tree?maxDepth=2').expect(200).expect(response => {
      expect(response.body.children.some((node: any) => node.name === 'src')).toBe(true);
    });
    await request(app).get('/api/files/search?q=routeValue&kind=content').expect(200).expect(response => {
      expect(response.body.results[0].path).toBe('src/app.ts');
    });
    await request(app).get('/api/files/read?path=src/app.ts&startLine=1&endLine=1').expect(200).expect(response => {
      expect(response.body.content).toContain('routeValue');
    });
    await request(app).get('/api/files/metadata?path=src/app.ts').expect(200).expect(response => {
      expect(response.body.previewable).toBe(true);
    });
    await request(app).post('/api/files/load-into-chat').send({ files: [{ path: 'src/app.ts' }] }).expect(200).expect(response => {
      expect(response.body.loadedFiles[0].path).toBe('src/app.ts');
    });
    await request(app).get('/api/files/read?path=.env').expect(500);
  });

  it('serves audio file, metadata, preview, waveform, and load endpoints', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-route-'));
    fs.mkdirSync(path.join(root, 'samples'));
    fs.writeFileSync(path.join(root, 'samples', 'hat.wav'), Buffer.from('RIFF0000WAVE'));
    const app = express();
    app.use(express.json());
    app.use(createAudioRouter(root));

    await request(app).get('/api/audio/files').expect(200).expect(response => {
      expect(response.body.files[0].path).toBe('samples/hat.wav');
    });
    await request(app).get('/api/audio/metadata?path=samples/hat.wav').expect(200).expect(response => {
      expect(response.body.format).toBe('wav');
    });
    await request(app).get('/api/audio/preview?path=samples/hat.wav').expect(200);
    await request(app).get('/api/audio/waveform?path=samples/hat.wav').expect(200).expect(response => {
      expect(response.body.points).toEqual([]);
    });
    await request(app).post('/api/audio/load-into-chat').send({ paths: ['samples/hat.wav'] }).expect(200).expect(response => {
      expect(response.body.loadedAudio[0].path).toBe('samples/hat.wav');
    });
  });

  it('routes broad gaming and online knowledge flows', async () => {
    const added: any[] = [];
    const app = express();
    app.use(express.json());
    app.use(createGamingRouter({
      gamingGeniusAgent: {
        ask: jest.fn().mockResolvedValue({ mode: 'gaming', response: 'gaming answer' })
      }
    }));
    app.use(createKnowledgeOnlineRouter({
      documentManager: {
        addText: jest.fn(async (text, metadata) => added.push({ text, metadata }))
      }
    }));

    await request(app).post('/api/gaming/ask').send({ message: 'speedrun routing' }).expect(200).expect(response => {
      expect(response.body.mode).toBe('gaming');
    });
    await request(app).post('/api/knowledge-online/miss').send({ message: 'new thing', domain: 'gaming' }).expect(200).expect(response => {
      expect(response.body.knowledgeMiss).toBe(true);
    });
    const search = await request(app).post('/api/knowledge-online/search').send({ query: 'Godot docs', domain: 'gaming' }).expect(200);
    expect(search.body.sources[0].url).toBe('https://example.com/godot');
    await request(app).post('/api/knowledge-online/ingest').send({ preview: search.body, sessionId: 'session-a' }).expect(200);
    expect(added[0].metadata.approvedBy).toBe('session-a');
  });
});
