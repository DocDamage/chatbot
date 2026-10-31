import express from 'express';
import request from 'supertest';
import { createCodeRouter } from './code';
import { requireAuth, requireRole } from '../../middleware/auth';
import { AuthService } from '../../core/auth/AuthService';
import { errorHandler } from '../../middleware/errorHandler';
import { getActiveRouteManifest } from '../routeManifest';

jest.mock('../../core/observability/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
describe('coding integrations HTTP boundaries', () => {
  const prior = { ...process.env };
  let app: express.Express, auth: AuthService, tools: any;
  beforeEach(() => {
    process.env.JWT_SECRET = 'coding-tests-signing-value-with-enough-characters';
    auth = new AuthService();
    tools = { status: jest.fn(() => ({ enabled: true })), propose: jest.fn(async () => ({ patch: { operations: [], conflicts: [], diff: '' } })),
      structural: jest.fn(async () => ({ matches: [] })), references: jest.fn(async () => ({ references: [] })), documentation: jest.fn(async () => ({ content: 'Source docs' })) };
    app = express(); app.use(express.json());
    app.use(requireAuth, requireRole('developer', 'admin'), createCodeRouter({ codingTools: tools })); app.use(errorHandler);
  });
  afterEach(() => { process.env = { ...prior }; });
  const token = (role: string, id = 'alice') => auth.generateToken({ id, roles: [role] });
  it('requires developer authentication and is excluded from hosted mounting', async () => {
    await request(app).get('/api/code/tools/status').expect(401);
    await request(app).get('/api/code/tools/status').auth(token('user'), { type: 'bearer' }).expect(403);
    await request(app).get('/api/code/tools/status').auth(token('developer'), { type: 'bearer' }).expect(200);
    expect(getActiveRouteManifest('hosted').some(route => route.name === 'code')).toBe(false);
  });
  it('validates tool inputs and takes the authenticated owner instead of a supplied user ID', async () => {
    await request(app).post('/api/code/tools/propose').auth(token('developer'), { type: 'bearer' }).send({ message: 'fix', files: 'not-an-array' }).expect(400);
    await request(app).post('/api/code/tools/propose').auth(token('developer'), { type: 'bearer' }).send({ message: 'fix', files: ['app.ts'], userId: 'spoofed' }).expect(200);
    expect(tools.propose).toHaveBeenCalledWith('alice', expect.objectContaining({ files: ['app.ts'] }), expect.any(AbortSignal));
  });
  it('serves explicit read-only tool calls without exposing arbitrary MCP dispatch', async () => {
    await request(app).post('/api/code/tools/structural').auth(token('developer'), { type: 'bearer' }).send({ files: ['app.ts'], pattern: '$X()', language: 'typescript' }).expect(200);
    await request(app).post('/api/code/tools/documentation').auth(token('developer'), { type: 'bearer' }).send({ library: '/microsoft/typescript', query: 'Compiler API' }).expect(200);
    await request(app).post('/api/code/tools/call').auth(token('developer'), { type: 'bearer' }).send({ tool: 'execute_shell_command' }).expect(404);
  });
});
