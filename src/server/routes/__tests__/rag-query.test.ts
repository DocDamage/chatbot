import express from 'express';
import request from 'supertest';
import { createRagQueryRouter } from '../rag-query';

describe('RAG query route', () => {
  it('runs a direct RAG query and returns retrieved chunks', async () => {
    const ragService = {
      processQuery: jest.fn().mockResolvedValue({
        response: 'The answer came from the knowledge base.',
        citations: [],
        retrievedChunks: [{ id: 'chunk-1', content: 'Knowledge base answer', metadata: { source: 'guide.md' } }],
        compressedContext: 'Knowledge base answer',
        metadata: { retrievalMethod: 'hybrid', compressionRatio: 1, numChunksRetrieved: 1 }
      })
    };
    const app = express();
    app.use(express.json());
    app.use(createRagQueryRouter({ ragService }));

    const response = await request(app)
      .post('/api/rag/query')
      .send({ query: 'What is in the knowledge base?', generateResponse: false });

    expect(response.status).toBe(200);
    expect(ragService.processQuery).toHaveBeenCalledWith('What is in the knowledge base?', false);
    expect(response.body).toMatchObject({
      response: 'The answer came from the knowledge base.',
      retrievedChunks: [{ id: 'chunk-1', content: 'Knowledge base answer' }]
    });
  });

  it('omits chunk embeddings unless explicitly requested', async () => {
    const ragService = {
      processQuery: jest.fn().mockResolvedValue({
        response: 'Answer',
        citations: [],
        retrievedChunks: [{
          id: 'chunk-1',
          content: 'Knowledge base answer',
          metadata: { source: 'guide.md' },
          embedding: [0.1, 0.2]
        }],
        compressedContext: 'Knowledge base answer',
        metadata: { retrievalMethod: 'hybrid', compressionRatio: 1, numChunksRetrieved: 1 }
      })
    };
    const app = express();
    app.use(express.json());
    app.use(createRagQueryRouter({ ragService }));

    const response = await request(app)
      .post('/api/rag/query')
      .send({ query: 'What is in the knowledge base?' });

    expect(response.status).toBe(200);
    expect(response.body.retrievedChunks[0]).not.toHaveProperty('embedding');
  });

  it('rejects blank queries', async () => {
    const app = express();
    app.use(express.json());
    app.use(createRagQueryRouter({ ragService: { processQuery: jest.fn() } }));

    const response = await request(app)
      .post('/api/rag/query')
      .send({ query: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('query is required');
  });
});
