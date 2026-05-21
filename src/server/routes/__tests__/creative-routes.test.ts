import express from 'express';
import request from 'supertest';
import { createCreativeWritingRouter } from '../creative';
import { errorHandler } from '../../../middleware/errorHandler';

describe('creative writing routes', () => {
  it('validates and routes scene drafting requests', async () => {
    const draftScene = jest.fn().mockResolvedValue({ response: 'scene draft', mode: 'draft_scene' });
    const app = express();
    app.use(express.json());
    app.use(createCreativeWritingRouter({ creativeWritingAgent: { draftScene } }));

    await request(app)
      .post('/api/creative/draft-scene')
      .send({
        prompt: 'Draft an eerie lighthouse scene.',
        genre: 'dark_horror',
        format: 'scene',
        rating: 'Teen',
        config: { length: 'short' },
      })
      .expect(200)
      .expect(response => {
        expect(response.body.response).toBe('scene draft');
        expect(draftScene).toHaveBeenCalledWith(expect.objectContaining({
          prompt: 'Draft an eerie lighthouse scene.',
          genre: 'dark_horror',
          rating: 'Teen',
        }));
      });
  });

  it('rejects malformed creative requests', async () => {
    const app = express();
    app.use(express.json());
    app.use(createCreativeWritingRouter());
    app.use(errorHandler);

    await request(app)
      .post('/api/creative/draft-scene')
      .send({
        prompt: '',
        rating: 'Anything Goes',
        config: { length: 'endless' },
      })
      .expect(400);
  });
});
