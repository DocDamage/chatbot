import express from 'express';
import request from 'supertest';
import { createMusicProductionGeniusRouter, createMusicRouter } from '../music';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(createMusicProductionGeniusRouter({}));
  return app;
}

describe('music specialist routes', () => {
  it('exports createMusicRouter as the canonical music router alias', () => {
    expect(createMusicRouter).toBe(createMusicProductionGeniusRouter);
  });

  it('routes Suno requests to the Suno specialist', async () => {
    const response = await request(createApp())
      .post('/api/music/suno')
      .send({ query: 'Make a Suno prompt for a dark cinematic trap song with female vocals.' })
      .expect(200);

    expect(response.body.model).toBe('suno-tools');
    expect(response.body.response).toContain('Suno Genius');
    expect(response.body.response).toContain('Hook direction');
    expect(response.body.response).toContain('Rights/copyright note');
  });

  it('routes FL Studio requests to FL Studio tools', async () => {
    const response = await request(createApp())
      .post('/api/music/fl-studio')
      .send({ query: 'My 808 sounds off-key in FL Studio. What should I check?' })
      .expect(200);

    expect(response.body.model).toBe('fl-studio-tools');
    expect(response.body.response).toContain('FL Studio Genius');
    expect(response.body.response).toContain('root note');
    expect(response.body.response).toContain('Piano Roll');
    expect(response.body.tools).toContain('FLPianoRollTool');
  });

  it('routes Pro Tools requests to recording and session tools', async () => {
    const response = await request(createApp())
      .post('/api/music/pro-tools')
      .send({ query: 'How should I set up a Pro Tools vocal recording session?' })
      .expect(200);

    expect(response.body.model).toBe('pro-tools-tools');
    expect(response.body.response).toContain('sample rate');
    expect(response.body.response).toContain('playlists');
    expect(response.body.tools).toContain('ProToolsSessionSetupTool');
  });

  it('routes Logic requests to Logic stock workflow tools', async () => {
    const response = await request(createApp())
      .post('/api/music/logic')
      .send({ query: 'Give me a stock Logic Pro vocal chain for modern rap vocals.' })
      .expect(200);

    expect(response.body.model).toBe('logic-tools');
    expect(response.body.response).toContain('Channel EQ');
    expect(response.body.response).toContain('reverb');
    expect(response.body.tools).toContain('LogicProjectSetupTool');
  });

  it('routes DAW translation requests to the DAW workflow mapper', async () => {
    const response = await request(createApp())
      .post('/api/music/daw-translate')
      .send({ query: 'Translate FL Studio Channel Rack workflow into Logic Pro.' })
      .expect(200);

    expect(response.body.model).toBe('music-tools');
    expect(response.body.response).toContain('DawWorkflowMapTool');
    expect(response.body.response).toContain('FL Studio Channel Rack -> Logic');
  });

  it('routes mix and master endpoints to diagnostic and loudness tools', async () => {
    const mix = await request(createApp())
      .post('/api/music/mix')
      .send({ query: 'My 808 and kick are fighting. What do I do?' })
      .expect(200);

    expect(mix.body.response).toContain('MixDiagnosticTool');
    expect(mix.body.response).toContain('masking');

    const master = await request(createApp())
      .post('/api/music/master')
      .send({ query: 'Master this trap song for streaming loudness.' })
      .expect(200);

    expect(master.body.response).toContain('MasteringChecklistTool');
    expect(master.body.response).toContain('LoudnessTargetTool');
  });

  it('routes Mix Genius plan and apply requests', async () => {
    const plan = await request(createApp())
      .post('/api/music/mix/plan')
      .send({ query: 'Make this beat mix cleaner and louder but keep the 808 huge.', genre: 'trap' })
      .expect(200);

    expect(plan.body.response).toContain('Mix Genius Plan');
    expect(plan.body.moves.length).toBeGreaterThan(0);

    const apply = await request(createApp())
      .post('/api/music/mix/apply')
      .send({ query: 'Make this beat mix cleaner and louder but keep the 808 huge.', permissionMode: 'dry_run' })
      .expect(200);

    expect(apply.body.flResult.dryRun).toBe(true);
  });
});
