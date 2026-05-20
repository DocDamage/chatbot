import express from 'express';
import request from 'supertest';
import { createFLStudioControlRouter, createFLStudioRouter } from '../flstudio';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(createFLStudioControlRouter({}));
  return app;
}

describe('FL Studio control routes', () => {
  it('exports createFLStudioRouter as the canonical router alias', () => {
    expect(createFLStudioRouter).toBe(createFLStudioControlRouter);
  });

  it('returns dry-run planned MCP actions for natural language commands', async () => {
    const response = await request(createApp())
      .post('/api/flstudio/command')
      .send({ query: 'Make a four-bar dark trap progression in F minor' })
      .expect(200);

    expect(response.body.mode).toBe('fl_studio_control');
    expect(response.body.dryRun).toBe(true);
    expect(response.body.actions.map((action: any) => action.tool)).toContain('fl_send_chord');
    expect(response.body.response).toContain('FL Studio Control Agent');
  });

  it('exposes status without requiring a running FL Studio MCP server', async () => {
    const response = await request(createApp())
      .get('/api/flstudio/status')
      .expect(200);

    expect(response.body.connected).toBe(false);
    expect(response.body.state.mode).toBe('dry_run');
  });

  it('exposes the current MCP tool list', async () => {
    const response = await request(createApp())
      .get('/api/flstudio/tools')
      .expect(200);

    expect(response.body.connected).toBe(false);
    expect(response.body.toolNames).toEqual([]);
  });

  it('exposes a disconnect endpoint', async () => {
    const response = await request(createApp())
      .post('/api/flstudio/disconnect')
      .expect(200);

    expect(response.body.connected).toBe(false);
  });

  it('plans direct chord route actions', async () => {
    const response = await request(createApp())
      .post('/api/flstudio/piano-roll/chord')
      .send({ notes: ['C3', 'Eb3', 'G3'], time: 0, duration: 2 })
      .expect(200);

    expect(response.body.actions[0].tool).toBe('fl_send_chord');
    expect(response.body.actions[0].args.notes).toEqual(['C3', 'Eb3', 'G3']);
  });

  it('supports guarded direct MCP tool calls', async () => {
    const response = await request(createApp())
      .post('/api/flstudio/tool-call')
      .send({ toolName: 'fl_get_transport_status', args: {} })
      .expect(200);

    expect(response.body.actions[0].tool).toBe('fl_get_transport_status');
    expect(response.body.dryRun).toBe(true);
    expect(response.body.toolResults[0].tool).toBe('fl_get_transport_status');
  });

  it('requires a tool name for direct MCP tool calls', async () => {
    await request(createApp())
      .post('/api/flstudio/tool-call')
      .send({ args: {} })
      .expect(400);
  });
});
