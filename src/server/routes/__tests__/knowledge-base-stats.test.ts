import express from 'express';
import request from 'supertest';
import { createKnowledgeBaseRouter } from '../knowledge-base';

describe('Knowledge base routes', () => {
  it('includes persistent source, chunk, and embedding counts in stats', async () => {
    const app = express();
    app.use(express.json());
    app.use(createKnowledgeBaseRouter({
      ragService: {},
      documentManager: {
        getStats: jest.fn().mockResolvedValue({
          hasEmbeddings: true,
          persistentStore: true,
          persistence: {
            sources: 2,
            chunks: 8,
            embeddings: 8
          }
        })
      }
    }));

    const response = await request(app).get('/api/knowledge-base/stats');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      persistentStore: true,
      persistence: {
        sources: 2,
        chunks: 8,
        embeddings: 8
      }
    });
  });

  it('lists persisted sources and OCR queue candidates', async () => {
    const app = express();
    app.use(express.json());
    const listSources = jest.fn().mockResolvedValue({
      total: 1,
      limit: 25,
      offset: 0,
      sources: [{ title: 'Scanned Notes', needsOcr: true }]
    });
    const getOcrQueue = jest.fn().mockResolvedValue({
      total: 1,
      limit: 10,
      offset: 0,
      sources: [{ title: 'Scanned Notes', needsOcr: true }]
    });

    app.use(createKnowledgeBaseRouter({
      ragService: {},
      ragDocumentStore: { listSources, getOcrQueue },
      documentManager: { getStats: jest.fn() }
    }));

    const sources = await request(app)
      .get('/api/knowledge-base/sources?limit=25&q=scanned&needsOcr=true');
    expect(sources.status).toBe(200);
    expect(sources.body.sources[0].title).toBe('Scanned Notes');
    expect(listSources).toHaveBeenCalledWith(expect.objectContaining({
      limit: 25,
      q: 'scanned',
      needsOcr: true
    }));

    const queue = await request(app).get('/api/knowledge-base/ocr-queue?limit=10');
    expect(queue.status).toBe(200);
    expect(queue.body.total).toBe(1);
    expect(getOcrQueue).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10
    }));
  });
});
