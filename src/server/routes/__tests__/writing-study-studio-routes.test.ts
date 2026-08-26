import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../../middleware/errorHandler';
import { createWritingStudioRouter } from '../writing-studio';
import { createStudyStudioRouter } from '../study-studio';

describe('Writing and Study Studio routes (PX-14/PX-15)', () => {
  const app = express();
  app.use(express.json({ limit: '3mb' }));
  app.use((req, _res, next) => {
    req.user = { userId: String(req.headers['x-test-user'] || 'studio-user'), roles: ['developer'] };
    next();
  });
  app.use(createWritingStudioRouter());
  app.use(createStudyStudioRouter());
  app.use(errorHandler);

  it('opens, edits, proofreads, and saves through the actual WritingStudioService', async () => {
    const opened = await request(app).post('/api/writing-studio/documents/open').send({
      title: 'Architecture Notes', content: '# Notes\n\nThis are a fixture document.'
    });
    expect(opened.status).toBe(201);
    expect(opened.body.document.metadata.title).toBe('Architecture Notes');

    const updated = await request(app).patch('/api/writing-studio/document').send({
      content: '# Notes\n\nThis is a revised fixture document.'
    });
    expect(updated.status).toBe(200);
    expect(updated.body.autosaveStatus).toBe('dirty');

    const proofread = await request(app).post('/api/writing-studio/proofread').send({});
    expect(proofread.status).toBe(200);
    expect(proofread.body.outline.headings[0].text).toBe('Notes');

    const saved = await request(app).post('/api/writing-studio/save').send({ commitMessage: 'Route test save' });
    expect(saved.status).toBe(200);
    expect(saved.body.state.autosaveStatus).toBe('saved');
  });

  it('keeps writing state per user and rejects cloud or oversized operations', async () => {
    await request(app).post('/api/writing-studio/documents/open').set('x-test-user', 'alice').send({ content: 'Alice document' });
    const bobState = await request(app).get('/api/writing-studio/state').set('x-test-user', 'bob');
    expect(bobState.body.activeDocument).toBeNull();
    expect((await request(app).patch('/api/writing-studio/document').set('x-test-user', 'bob').send({ content: 'No document' })).status).toBe(409);

    const cloud = await request(app).post('/api/writing-studio/proposals').set('x-test-user', 'alice').send({
      action: 'rewrite', preferCloud: true
    });
    expect(cloud.status).toBe(400);

    const oversized = await request(app).post('/api/writing-studio/documents/open').send({ content: 'x'.repeat(2 * 1024 * 1024 + 1) });
    expect(oversized.status).toBe(413);
  });

  it('uses a healthy local writing backend for reviewable accept and reject proposals', async () => {
    const localApp = express();
    localApp.use(express.json());
    localApp.use(createWritingStudioRouter(process.cwd(), {
      autoDiscover: false,
      aiBackend: {
        health: async () => ({ available: true, models: ['fixture-model'] }),
        transform: async ({ text, action }) => `${action.toUpperCase()}: ${text}`
      }
    }));
    localApp.use(errorHandler);

    await request(localApp).post('/api/writing-studio/documents/open').send({ content: 'A verbose sentence.' }).expect(201);
    await request(localApp).post('/api/writing-studio/proposals').send({ action: 'not-real' }).expect(400);

    const first = await request(localApp).post('/api/writing-studio/proposals').send({ action: 'concise' }).expect(201);
    expect(first.body.proposal.providerModel).toBeTruthy();
    await request(localApp)
      .post(`/api/writing-studio/proposals/${first.body.proposal.id}/accept`)
      .expect(200)
      .expect(response => expect(response.body.document.rawText).toBe('CONCISE: A verbose sentence.'));

    const second = await request(localApp).post('/api/writing-studio/proposals').send({ action: 'rewrite' }).expect(201);
    await request(localApp)
      .post(`/api/writing-studio/proposals/${second.body.proposal.id}/reject`)
      .expect(200)
      .expect(response => expect(response.body.proposal.status).toBe('rejected'));
  });

  it('returns 503 when the configured local writing backend is unhealthy', async () => {
    const localApp = express();
    localApp.use(express.json());
    localApp.use(createWritingStudioRouter(process.cwd(), {
      autoDiscover: false,
      aiBackend: {
        health: async () => ({ available: false }),
        transform: async ({ text }) => text
      }
    }));
    localApp.use(errorHandler);
    await request(localApp).post('/api/writing-studio/documents/open').send({ content: 'Keep this local.' }).expect(201);
    await request(localApp).post('/api/writing-studio/proposals').send({ action: 'concise' }).expect(503);
  });

  it('creates a source-grounded collection and generates study artifacts', async () => {
    const collection = await request(app).post('/api/study-studio/collections').send({
      title: 'Routing', subject: 'Software architecture', targetLevel: 'intermediate'
    });
    expect(collection.status).toBe(201);

    const source = await request(app).post('/api/study-studio/sources').send({
      title: 'Route notes',
      format: 'markdown',
      content: '# Route Policy\nRoutes require authentication and profile checks.\n\n## Approval\nDangerous actions require exact-scope approval.'
    });
    expect(source.status).toBe(201);
    expect(source.body.chunks.length).toBeGreaterThan(0);

    const note = await request(app).post('/api/study-studio/notes').send({ noteType: 'outline' });
    expect(note.status).toBe(201);
    expect(note.body.note.sourceAnchors.length).toBeGreaterThan(0);

    const flashcards = await request(app).post('/api/study-studio/flashcards/generate').send({});
    expect(flashcards.status).toBe(201);
    expect(Array.isArray(flashcards.body.flashcards)).toBe(true);

    const plan = await request(app).post('/api/study-studio/plan').send({ dailyMinutes: 30 });
    expect(plan.status).toBe(201);
    expect(plan.body.plan.dailyMinutesBudget).toBe(30);
  });

  it('rejects malformed study requests and isolates collections by user', async () => {
    expect((await request(app).post('/api/study-studio/collections').send({ title: '', subject: '' })).status).toBe(400);
    expect((await request(app).post('/api/study-studio/collections').send({ title: 'X', subject: 'Y', targetLevel: 'impossible' })).status).toBe(400);
    expect((await request(app).post('/api/study-studio/sources').send({ content: '' })).status).toBe(400);

    const otherState = await request(app).get('/api/study-studio/state').set('x-test-user', 'different-user');
    expect(otherState.status).toBe(200);
    expect(otherState.body.collection).toBeNull();
    expect((await request(app).post('/api/study-studio/notes').set('x-test-user', 'different-user').send({ noteType: 'outline' })).status).toBe(409);
  });
});
