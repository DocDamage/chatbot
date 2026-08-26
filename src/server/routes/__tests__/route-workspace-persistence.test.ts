import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { AuthService } from '../../../core/auth/AuthService';
import { createDocumentWorkspaceRouter } from '../document-workspace';
import { createExportRouter } from '../export';
import { createProjectMemoryRouter } from '../project-memory';
import { createProjectIntelligenceRouter } from '../project-intelligence';
import { createWebsiteWorkspaceRouter } from '../website-workspace';
import { streamChat } from '../chat-stream';
import { createContextEconomyRouter } from '../context-economy/contextInspectorRoutes';

describe('HTTP route decision matrices - Workspace, Persistence & Context Economy', () => {
  let tempDir: string;
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-routes-123456';
    const authService = new AuthService();
    authToken = `Bearer ${authService.generateToken({ id: 'user-123', email: 'test@example.com', roles: ['admin'] })}`;
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-route-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Document Workspace Router', () => {
    it('handles review, transform, and save with and without documentManager', async () => {
      const mockDocManager = {
        addText: jest.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }])
      };
      const app = express();
      app.use(express.json());
      app.use(createDocumentWorkspaceRouter({ documentManager: mockDocManager }, tempDir));

      // Review
      const reviewRes = await request(app)
        .post('/api/document-workspace/review')
        .send({ title: 'My Doc', content: 'This is a test document with facts.' })
        .expect(200);
      expect(reviewRes.body).toHaveProperty('token');
      const token = reviewRes.body.token;

      // Transform with supported actions
      const transRes = await request(app)
        .post('/api/document-workspace/transform')
        .send({ action: 'concise', content: 'Long document text here.' })
        .expect(200);
      expect(transRes.body).toHaveProperty('content');

      const transBullet = await request(app)
        .post('/api/document-workspace/transform')
        .send({ action: 'bullet-list', content: 'Point 1\nPoint 2' })
        .expect(200);
      expect(transBullet.body.content).toContain('- Point 1');

      const transProf = await request(app)
        .post('/api/document-workspace/transform')
        .send({ action: 'professional', content: "We can't accept this." })
        .expect(200);
      expect(transProf.body.content).toContain('cannot');

      // Save with valid token and docManager
      const saveRes = await request(app)
        .post('/api/document-workspace/save')
        .send({
          title: 'My Doc',
          content: 'This is a test document with facts.',
          token,
          domain: 'science',
          tags: ['test', 'doc']
        })
        .expect(201);
      expect(saveRes.body).toHaveProperty('saved', true);
      expect(saveRes.body).toHaveProperty('chunks', 2);
      expect(mockDocManager.addText).toHaveBeenCalled();

      // App without docManager
      const appNoDoc = express();
      appNoDoc.use(express.json());
      appNoDoc.use(createDocumentWorkspaceRouter({}, tempDir));

      const reviewRes2 = await request(appNoDoc)
        .post('/api/document-workspace/review')
        .send({ title: 'Another', content: 'Some more content here.' })
        .expect(200);

      const saveRes2 = await request(appNoDoc)
        .post('/api/document-workspace/save')
        .send({
          title: 'Another',
          content: 'Some more content here.',
          token: reviewRes2.body.token
        })
        .expect(201);
      expect(saveRes2.body.chunks).toBe(0);
    });
  });

  describe('Export/Import Router', () => {
    it('handles knowledge-base export and conversation export', async () => {
      const mockDocManager = {
        getStats: jest.fn().mockResolvedValue({ persistence: { sources: 5, chunks: 20 } }),
        addText: jest.fn().mockResolvedValue([{ id: 'c1' }]),
        addFile: jest.fn().mockResolvedValue([{ id: 'c2' }]),
      };

      const app = express();
      app.use(express.json());
      app.use('/api', createExportRouter({ documentManager: mockDocManager }));

      // Export knowledge base with valid auth
      const kbRes = await request(app)
        .get('/api/knowledge-base')
        .set('Authorization', authToken)
        .expect(200);
      expect(kbRes.body.metadata.totalDocuments).toBe(5);

      // Export conversations with valid auth
      const convRes = await request(app)
        .get('/api/conversations?sessionId=session-1')
        .set('Authorization', authToken)
        .expect(200);
      expect(convRes.body).toHaveProperty('sessionId', 'session-1');

      // Import valid documents
      const importRes = await request(app)
        .post('/api/import/knowledge-base')
        .set('Authorization', authToken)
        .send({
          documents: [
            { text: 'Sample doc text', metadata: { title: 'T1' } },
            { filePath: 'path/to/file.txt' }
          ]
        })
        .expect(200);
      expect(importRes.body.imported).toBe(2);

      // Import non-array
      await request(app)
        .post('/api/import/knowledge-base')
        .set('Authorization', authToken)
        .send({ documents: 'invalid' })
        .expect(400);

      // Import with throwing error
      mockDocManager.addText.mockRejectedValueOnce(new Error('Ingestion failure'));
      const importErrRes = await request(app)
        .post('/api/import/knowledge-base')
        .set('Authorization', authToken)
        .send({ documents: [{ text: 'fail text' }] })
        .expect(200);
      expect(importErrRes.body.errors.length).toBe(1);

      // App with missing doc manager
      const unavailApp = express();
      unavailApp.use(express.json());
      unavailApp.use('/api', createExportRouter({}));

      await request(unavailApp)
        .get('/api/knowledge-base')
        .set('Authorization', authToken)
        .expect(503);
      await request(unavailApp)
        .post('/api/import/knowledge-base')
        .set('Authorization', authToken)
        .send({ documents: [] })
        .expect(503);
    });

    it('validates authentication and conversation export parameters', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api', createExportRouter({}));

      // Missing auth
      await request(app).get('/api/conversations').expect(401);

      // Valid auth with sessionId
      const authService = new AuthService();
      const emptyUserToken = `Bearer ${authService.generateToken({ id: '', roles: [] })}`;
      await request(app).get('/api/conversations').set('Authorization', emptyUserToken).expect(400);
    });
  });

  describe('Project Memory Router', () => {
    it('handles status, entries list, remember, and resume', async () => {
      const app = express();
      app.use(express.json());
      app.use(createProjectMemoryRouter(tempDir));

      await request(app).get('/api/project-memory/status').expect(200);

      const listEmpty = await request(app).get('/api/project-memory/entries?q=test&category=note&limit=10').expect(200);
      expect(listEmpty.body).toHaveProperty('entries');

      // Remember empty content
      await request(app).post('/api/project-memory/entries').send({ content: '' }).expect(400);

      // Remember valid content
      const remRes = await request(app)
        .post('/api/project-memory/entries')
        .send({ content: 'Important project decision', category: 'architecture', tags: ['db', 'schema'] })
        .expect(201);
      expect(remRes.body.entry).toHaveProperty('content', 'Important project decision');

      // Resume
      const resRes = await request(app).post('/api/project-memory/resume').expect(200);
      expect(resRes.body).toBeDefined();
    });
  });

  describe('Project Intelligence Router', () => {
    it('handles overview, file inspection, and history', async () => {
      fs.writeFileSync(path.join(tempDir, 'file.ts'), 'export const a = 1;\n', 'utf8');

      const app = express();
      app.use(express.json());
      app.use(createProjectIntelligenceRouter(tempDir));

      const overviewRes = await request(app).get('/api/project-intelligence/overview?maxFiles=10').expect(200);
      expect(overviewRes.body).toBeDefined();

      await request(app).get('/api/project-intelligence/file').expect(400);

      const fileRes = await request(app).get('/api/project-intelligence/file?path=file.ts').expect(200);
      expect(fileRes.body).toBeDefined();

      const histRes = await request(app).get('/api/project-intelligence/history?limit=5').expect(200);
      expect(histRes.body).toHaveProperty('commits');
    });
  });

  describe('Website Workspace Router', () => {
    it('handles full project lifecycle and block operations', async () => {
      const app = express();
      app.use(express.json());
      app.use(createWebsiteWorkspaceRouter(tempDir));

      // Project & Preview
      const projRes = await request(app).get('/api/website-workspace/project').expect(200);
      expect(projRes.body).toHaveProperty('project');
      const pageId = projRes.body.project.pages[0].id;

      await request(app).post('/api/website-workspace/project').expect(201);

      const prevRes = await request(app)
        .post('/api/website-workspace/preview')
        .send({ slug: 'home', viewport: 'desktop', enableInspectMarkers: true })
        .expect(200);
      expect(prevRes.body).toHaveProperty('html');

      // Templates
      const tempRes = await request(app).get('/api/website-workspace/templates').expect(200);
      expect(tempRes.body).toHaveProperty('templates');

      // Add block
      const addRes = await request(app)
        .post('/api/website-workspace/blocks')
        .send({ pageId, type: 'hero', targetIndex: 0 })
        .expect(201);
      const blockId = addRes.body.block?.id;

      if (blockId) {
        // Update block
        await request(app)
          .patch(`/api/website-workspace/blocks/${blockId}`)
          .send({ pageId, updates: { content: { heading: 'Updated Heading' } } })
          .expect(200);

        // Duplicate block
        await request(app)
          .post(`/api/website-workspace/blocks/${blockId}/duplicate`)
          .send({ pageId })
          .expect(201);

        // Reorder block
        await request(app)
          .post(`/api/website-workspace/blocks/${blockId}/reorder`)
          .send({ pageId, newIndex: 1 })
          .expect(200);

        // Delete block
        await request(app)
          .delete(`/api/website-workspace/blocks/${blockId}`)
          .send({ pageId })
          .expect(200);
      }

      // Undo / Redo
      await request(app).post('/api/website-workspace/undo').expect(200);
      await request(app).post('/api/website-workspace/redo').expect(200);

      // Assets
      await request(app).get('/api/website-workspace/assets').expect(200);
      await request(app)
        .post('/api/website-workspace/assets')
        .send({ name: 'logo.png', path: 'assets/logo.png', type: 'image', size: 1024 })
        .expect(201);

      // Inspect & Source Link
      await request(app).get(`/api/website-workspace/inspect?pageId=${pageId}&blockId=hero-1`).expect(200);
      await request(app)
        .post('/api/website-workspace/source-link')
        .send({ blockId: 'hero-1', pageId })
        .expect(200);
    });
  });

  describe('Chat Stream & Context Economy Routers', () => {
    it('streamChat writes SSE chunks and completes', async () => {
      const mockOrchestrator = {
        processRequest: jest.fn().mockResolvedValue({ response: 'Hello world from streaming' })
      };

      const app = express();
      app.use(express.json());
      app.post('/api/chat/stream', (req, res) => streamChat(req, res, mockOrchestrator as any));

      const res = await request(app)
        .post('/api/chat/stream')
        .send({ message: 'Hi', sessionId: 's1', userId: 'u1' })
        .expect(200);

      expect(res.text).toContain('connected');
      expect(res.text).toContain('chunk');
      expect(res.text).toContain('complete');
    });

    it('ContextEconomyRouter handles compress, retrieve, benchmark, proposals and review', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/context-economy', createContextEconomyRouter());

      // Compression validation
      await request(app).post('/api/context-economy/compress').send({ text: 123 }).expect(400);

      // Valid compression
      const compRes = await request(app)
        .post('/api/context-economy/compress')
        .send({ text: 'Some compressible text content here.' })
        .expect(200);
      expect(compRes.body).toHaveProperty('result');

      // Retrieve non-existing key
      await request(app).get('/api/context-economy/retrieve/non-existent-key').expect(404);

      // Proposals list
      const propRes = await request(app).get('/api/context-economy/proposals').expect(200);
      expect(propRes.body).toHaveProperty('proposals');

      // Proposal review validation
      await request(app).post('/api/context-economy/proposals/prop-1/review').send({ decision: 'invalid' }).expect(400);
      await request(app).post('/api/context-economy/proposals/prop-1/review').send({ decision: 'approved' }).expect(404);
    });
  });
});
