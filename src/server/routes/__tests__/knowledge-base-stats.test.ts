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
});
