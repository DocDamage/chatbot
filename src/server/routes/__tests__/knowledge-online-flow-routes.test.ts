import express from 'express';
import request from 'supertest';
import { createKnowledgeOnlineRouter } from '../knowledge-online';

jest.mock('../../../core/tools/WebSearcher', () => ({
  WebSearcher: {
    fromEnv: jest.fn(() => ({
      search: jest.fn().mockResolvedValue({
        data: {
          results: [
            {
              title: 'Engine docs',
              url: 'https://example.com/engine-docs',
              snippet: 'Engine documentation summary.'
            }
          ]
        }
      })
    }))
  }
}));

function makeApp(services: any) {
  const app = express();
  app.use(express.json());
  app.use(createKnowledgeOnlineRouter(services));
  return app;
}

describe('knowledge-online confidence flow routes', () => {
  it('returns local answer when confidence is high', async () => {
    const app = makeApp({
      ragService: {
        processQuery: jest.fn().mockResolvedValue({ answer: 'local answer', confidence: 0.9 })
      }
    });

    await request(app)
      .post('/api/knowledge-online/check')
      .send({ question: 'known topic' })
      .expect(200)
      .expect(response => {
        expect(response.body.needsOnlineResearch).toBe(false);
        expect(response.body.answer).toBe('local answer');
      });
  });

  it('returns an online research handoff when local confidence is low', async () => {
    const app = makeApp({
      ragService: {
        processQuery: jest.fn().mockResolvedValue({ answer: 'weak answer', confidence: 0.1 })
      }
    });

    await request(app)
      .post('/api/knowledge-online/check')
      .send({ question: 'unknown topic', domain: 'gaming' })
      .expect(200)
      .expect(response => {
        expect(response.body.needsOnlineResearch).toBe(true);
        expect(response.body.suggestedQuery).toBe('unknown topic');
        expect(response.body.miss.knowledgeMiss).toBe(true);
        expect(response.body.miss.domain).toBe('gaming');
      });
  });

  it('searches and ingests in one approved call', async () => {
    const added: any[] = [];
    const app = makeApp({
      documentManager: {
        addText: jest.fn(async (text, metadata) => {
          added.push({ text, metadata });
          return [{ id: 'chunk-1' }];
        })
      }
    });

    await request(app)
      .post('/api/knowledge-online/search-and-ingest')
      .send({ query: 'engine docs', approved: true, approvedBy: 'reviewer-a' })
      .expect(200)
      .expect(response => {
        expect(response.body.ingested).toBe(true);
        expect(response.body.preview.sources[0].url).toBe('https://example.com/engine-docs');
        expect(response.body.ingestion.ingested).toBe(1);
      });

    expect(added[0].metadata.approvedBy).toBe('reviewer-a');
    expect(added[0].metadata.ingestionMethod).toBe('online-approved-summary');
  });

  it('returns only a preview when search-and-ingest is not approved', async () => {
    const addText = jest.fn();
    const app = makeApp({ documentManager: { addText } });

    await request(app)
      .post('/api/knowledge-online/search-and-ingest')
      .send({ query: 'engine docs' })
      .expect(200)
      .expect(response => {
        expect(response.body.ingested).toBe(false);
        expect(response.body.preview.sources).toHaveLength(1);
      });

    expect(addText).not.toHaveBeenCalled();
  });
});
