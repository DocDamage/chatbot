import express from 'express';
import request from 'supertest';
import { createWritingStudioRouter } from '../writing-studio';
import { errorHandler } from '../../../middleware/errorHandler';

describe('RT-WRITE-001: WritingStudio API Routes Suite', () => {
  let app: express.Express;
  let mockAiBackend: any;

  beforeEach(() => {
    mockAiBackend = {
      health: jest.fn().mockResolvedValue({ available: true, models: ['qwen3:8b'] }),
      transform: jest.fn().mockResolvedValue('Enhanced and concise text summary.')
    };

    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(createWritingStudioRouter(process.cwd(), {
      autoDiscover: false,
      aiBackend: mockAiBackend
    }));
    app.use(errorHandler);
  });

  it('manages document lifecycle: state, open, patch, proofread, and save', async () => {
    // 1. Initial empty state
    const initialState = await request(app).get('/api/writing-studio/state').expect(200);
    expect(initialState.body.activeDocument).toBeNull();

    // 2. Open document
    const openRes = await request(app)
      .post('/api/writing-studio/documents/open')
      .send({ title: 'Design Document', content: '# Section 1\nInitial content paragraph.' })
      .expect(201);
    expect(openRes.body.document.metadata.title).toBe('Design Document');
    expect(openRes.body.state.activeDocument).toBeDefined();

    // 3. Patch text
    const patchRes = await request(app)
      .patch('/api/writing-studio/document')
      .send({ content: '# Section 1\nUpdated content with more details.\n# Section 2\nSecond heading.' })
      .expect(200);
    expect(patchRes.body.document.rawText).toContain('Updated content');

    // 4. Proofread & outline
    const proofRes = await request(app)
      .post('/api/writing-studio/proofread')
      .expect(200);
    expect(proofRes.body.outline.headings.length).toBe(2);

    // 5. Save document
    const saveRes = await request(app)
      .post('/api/writing-studio/save')
      .send({ commitMessage: 'Saved design doc version 1' })
      .expect(200);
    expect(saveRes.body.document.isDirty).toBe(false);
    expect(saveRes.body.state.autosaveStatus).toBe('saved');
  });

  it('rejects document updates when no active document is open', async () => {
    const res = await request(app)
      .patch('/api/writing-studio/document')
      .send({ content: 'Orphan update' })
      .expect(409);
    expect(JSON.stringify(res.body)).toContain('No active Writing Studio document');
  });

  it('validates document size and rejects payloads over 2 MB', async () => {
    const hugeContent = 'x'.repeat(2.5 * 1024 * 1024);
    const res = await request(app)
      .post('/api/writing-studio/documents/open')
      .send({ title: 'Big Doc', content: hugeContent })
      .expect(413);
    expect(JSON.stringify(res.body)).toContain('exceeds the 2 MB');
  });

  it('generates, accepts, and rejects AI writing proposals', async () => {
    // Open document first
    await request(app)
      .post('/api/writing-studio/documents/open')
      .send({ title: 'Proposal Test', content: 'Here is some rough draft text.' })
      .expect(201);

    // Reject unsupported action
    const badAction = await request(app)
      .post('/api/writing-studio/proposals')
      .send({ action: 'invalid_action' })
      .expect(400);
    expect(badAction.body.error).toContain('Unsupported writing action');

    // Reject preferCloud
    const cloudRefusal = await request(app)
      .post('/api/writing-studio/proposals')
      .send({ action: 'rewrite', preferCloud: true })
      .expect(400);
    expect(cloudRefusal.body.error).toContain('Cloud writing providers are disabled');

    // Valid proposal generation
    const propRes = await request(app)
      .post('/api/writing-studio/proposals')
      .send({ action: 'summarize', instruction: 'Make it 1 sentence' })
      .expect(201);
    expect(propRes.body.proposal.id).toBeDefined();

    const proposalId = propRes.body.proposal.id;

    // Reject proposal
    const rejectRes = await request(app)
      .post(`/api/writing-studio/proposals/${proposalId}/reject`)
      .expect(200);
    expect(rejectRes.body.proposal.status).toBe('rejected');

    // Generate another proposal and accept it
    const propRes2 = await request(app)
      .post('/api/writing-studio/proposals')
      .send({ action: 'rewrite' })
      .expect(201);

    const acceptRes = await request(app)
      .post(`/api/writing-studio/proposals/${propRes2.body.proposal.id}/accept`)
      .expect(200);
    expect(acceptRes.body.document).toBeDefined();
  });
});
