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

  it('covers connect, state, notes, step-sequence, mixer/set, and transport routes', async () => {
    const app = createApp();

    // 1. connect, state, disconnect
    const connectRes = await request(app).post('/api/flstudio/connect').send({ command: '', host: '127.0.0.1' }).expect(200);
    expect(connectRes.body).toBeDefined();

    const stateRes = await request(app).get('/api/flstudio/state').expect(200);
    expect(stateRes.body.mode).toBe('dry_run');

    await request(app).post('/api/flstudio/disconnect').expect(200);

    // 2. piano-roll/notes
    const notesRes = await request(app)
      .post('/api/flstudio/piano-roll/notes')
      .send({ notes: [{ note: 'C4', time: 0, duration: 1 }] })
      .expect(200);
    expect(notesRes.body.actions[0].tool).toBe('fl_send_notes');

    // 3. channel/step-sequence
    const seqRes = await request(app)
      .post('/api/flstudio/channel/step-sequence')
      .send({ channel: 'kick', steps: [0, 4, 8, 12] })
      .expect(200);
    expect(seqRes.body.actions[0].tool).toBe('fl_set_step_sequence');

    // 4. mixer/set (volume, pan, mute, solo)
    const mixerRes = await request(app)
      .post('/api/flstudio/mixer/set')
      .send({ track: 2, dbChange: -3, pan: -0.2, mute: true, solo: false })
      .expect(200);
    expect(mixerRes.body.actions.length).toBe(4);

    // 5. transport (record, stop, play)
    const recordRes = await request(app).post('/api/flstudio/transport').send({ action: 'record' }).expect(200);
    expect(recordRes.body.actions[0].tool).toBe('fl_record');

    const stopRes = await request(app).post('/api/flstudio/transport').send({ action: 'stop' }).expect(200);
    expect(stopRes.body.actions[0].tool).toBe('fl_stop');

    const playRes = await request(app).post('/api/flstudio/transport').send({ action: 'play' }).expect(200);
    expect(playRes.body.actions[0].tool).toBe('fl_play');
  });
});
