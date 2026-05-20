import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';

export function createRagQueryRouter(services: any): Router {
  const router = Router();

  router.post('/api/rag/query', asyncHandler(async (req, res) => {
    if (!services?.ragService) {
      return res.status(503).json({ error: 'RAG service not initialized' });
    }

    const rawQuery = typeof req.body.query === 'string' ? req.body.query : '';
    const query = sanitizeInput(rawQuery);

    if (!query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const generateResponse = req.body.generateResponse !== false;
    const result = await services.ragService.processQuery(query, generateResponse);
    const includeEmbeddings = req.body.includeEmbeddings === true;

    res.json(includeEmbeddings ? result : {
      ...result,
      retrievedChunks: result.retrievedChunks.map((chunk: any) => {
        const { embedding, ...chunkWithoutEmbedding } = chunk;
        return chunkWithoutEmbedding;
      })
    });
  }));

  return router;
}
