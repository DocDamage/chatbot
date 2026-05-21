import express from 'express';
import request from 'supertest';
import { apiErrorSchema } from './apiErrorSchema';
import { errorHandler } from './errorHandler';
import { ValidationError } from '../utils/errors';

describe('apiErrorSchema', () => {
  it('normalizes legacy string error responses', async () => {
    const app = express();
    app.use(apiErrorSchema);
    app.get('/legacy', (_req, res) => {
      res.status(400).json({ error: 'q is required' });
    });

    const response = await request(app).get('/legacy').expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'q is required',
        code: 'BAD_REQUEST',
      },
    });
  });

  it('uses the same schema for AppError instances', async () => {
    const app = express();
    app.use(apiErrorSchema);
    app.get('/thrown', () => {
      throw new ValidationError('name is required', { field: 'name' });
    });
    app.use(errorHandler);

    const response = await request(app).get('/thrown').expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'name is required',
        code: 'VALIDATION_ERROR',
        details: { field: 'name' },
      },
    });
  });
});
