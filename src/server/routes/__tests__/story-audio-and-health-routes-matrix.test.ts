import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import express from 'express';
import request from 'supertest';
import { createStoryGeniusRouter } from '../story';
import { createAudioRouter } from '../audio';
import { createHealthGeniusRouter } from '../health';

describe('B75-08: Story, Audio, and Health Routes Matrix', () => {
  describe('Story Genius Routes (/api/story/*)', () => {
    const mockAgent = {
      ask: jest.fn().mockResolvedValue({ answer: 'Story ask response' }),
      plot: jest.fn().mockResolvedValue({ plot: 'Act 1, 2, 3 structure' }),
      character: jest.fn().mockResolvedValue({ character: 'Character arc profile' }),
      worldbuild: jest.fn().mockResolvedValue({ world: 'Cyberpunk realm rules' }),
      dialogue: jest.fn().mockResolvedValue({ dialogue: 'Punchy dialogue scene' }),
      continuity: jest.fn().mockResolvedValue({ continuity: 'No plot holes found' })
    };

    const appWithInjected = express();
    appWithInjected.use(express.json());
    appWithInjected.use(createStoryGeniusRouter({ storyGeniusAgent: mockAgent }));

    const appDefault = express();
    appDefault.use(express.json());
    appDefault.use(createStoryGeniusRouter({}));

    it('handles /api/story/ask with query or message parameter', async () => {
      const res1 = await request(appWithInjected).post('/api/story/ask').send({ query: 'How to begin?' });
      expect(res1.status).toBe(200);
      expect(res1.body.answer).toBe('Story ask response');

      const res2 = await request(appWithInjected).post('/api/story/ask').send({ message: 'Alternative param' });
      expect(res2.status).toBe(200);
    });

    it('handles /api/story/plot, /character, /worldbuild, /dialogue, and /continuity', async () => {
      const resPlot = await request(appWithInjected).post('/api/story/plot').send({ query: 'Plot arc' });
      expect(resPlot.status).toBe(200);
      expect(resPlot.body.plot).toBe('Act 1, 2, 3 structure');

      const resChar = await request(appWithInjected).post('/api/story/character').send({ message: 'Protagonist' });
      expect(resChar.status).toBe(200);

      const resWorld = await request(appWithInjected).post('/api/story/worldbuild').send({ query: 'Magic system' });
      expect(resWorld.status).toBe(200);

      const resDiag = await request(appWithInjected).post('/api/story/dialogue').send({ message: 'Conversation' });
      expect(resDiag.status).toBe(200);

      const resCont = await request(appWithInjected).post('/api/story/continuity').send({});
      expect(resCont.status).toBe(200);
    });

    it('executes default StoryGeniusAgent instantiation when no service is injected', async () => {
      const res = await request(appDefault).post('/api/story/ask').send({ query: 'Hello story' });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('Audio Library Routes (/api/audio/*)', () => {
    let tempDir: string;
    let sampleWav: string;
    let app: express.Express;

    beforeAll(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-route-test-'));
      sampleWav = path.join(tempDir, 'sample.wav');
      fs.writeFileSync(sampleWav, Buffer.alloc(64));

      app = express();
      app.use(express.json());
      app.use(createAudioRouter(tempDir));
    });

    afterAll(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('returns audio files list and handles query filters', async () => {
      const res = await request(app).get('/api/audio/files?limit=10&offset=0&q=test');
      expect(res.status).toBe(200);
    });

    it('validates required path for metadata, preview, waveform, and analyze', async () => {
      // Missing path returns 400
      const resMeta400 = await request(app).get('/api/audio/metadata');
      expect(resMeta400.status).toBe(400);

      const resPrev400 = await request(app).get('/api/audio/preview');
      expect(resPrev400.status).toBe(400);

      const resWave400 = await request(app).get('/api/audio/waveform');
      expect(resWave400.status).toBe(400);

      const resAnalyze400 = await request(app).post('/api/audio/analyze').send({});
      expect(resAnalyze400.status).toBe(400);

      // Valid path calls
      const resMeta = await request(app).get('/api/audio/metadata?path=sample.wav');
      expect(resMeta.status).toBe(200);

      const resPrev = await request(app).get('/api/audio/preview?path=sample.wav');
      expect(resPrev.status).toBe(200);

      const resWave = await request(app).get('/api/audio/waveform?path=sample.wav');
      expect(resWave.status).toBe(200);

      const resAnalyze = await request(app).post('/api/audio/analyze').send({ path: 'sample.wav' });
      expect(resAnalyze.status).toBe(200);
    });

    it('loads audio files into chat via /api/audio/load-into-chat', async () => {
      const res = await request(app)
        .post('/api/audio/load-into-chat')
        .send({ paths: ['sample.wav'] });
      expect(res.status).toBe(200);
      expect(res.body.loadedAudio).toBeDefined();
    });
  });

  describe('Health Genius Routes (/api/health/*)', () => {
    const mockAgent = {
      ask: jest.fn().mockResolvedValue({ answer: 'Health guidance' }),
      anatomy: jest.fn().mockResolvedValue({ overview: 'Cardiac system' }),
      fitness: jest.fn().mockResolvedValue({ routine: 'Hypertrophy program' }),
      nutrition: jest.fn().mockResolvedValue({ macros: 'High protein distribution' }),
      redFlags: jest.fn().mockResolvedValue({ redFlags: ['Severe chest pain'] }),
      medication: jest.fn().mockResolvedValue({ info: 'Analgesic dosage safety' })
    };

    const appWithInjected = express();
    appWithInjected.use(express.json());
    appWithInjected.use(createHealthGeniusRouter({ healthGeniusAgent: mockAgent }));

    const appDefault = express();
    appDefault.use(express.json());
    appDefault.use(createHealthGeniusRouter({}));

    it('handles /api/health/ask with query or message', async () => {
      const res1 = await request(appWithInjected).post('/api/health/ask').send({ query: 'What is resting heart rate?' });
      expect(res1.status).toBe(200);
      expect(res1.body.answer).toBe('Health guidance');

      const res2 = await request(appWithInjected).post('/api/health/ask').send({ message: 'Alternative' });
      expect(res2.status).toBe(200);
    });

    it('handles /anatomy, /fitness, /nutrition, /red-flags, and /medication', async () => {
      const resAnat = await request(appWithInjected).post('/api/health/anatomy').send({ query: 'Heart' });
      expect(resAnat.status).toBe(200);

      const resFit = await request(appWithInjected).post('/api/health/fitness').send({ message: 'Strength' });
      expect(resFit.status).toBe(200);

      const resNut = await request(appWithInjected).post('/api/health/nutrition').send({ query: 'Protein' });
      expect(resNut.status).toBe(200);

      const resFlags = await request(appWithInjected).post('/api/health/red-flags').send({ query: 'Symptoms' });
      expect(resFlags.status).toBe(200);

      const resMed = await request(appWithInjected).post('/api/health/medication').send({});
      expect(resMed.status).toBe(200);
    });

    it('executes default HealthGeniusAgent when no agent is injected', async () => {
      const res = await request(appDefault).post('/api/health/ask').send({ query: 'Health check' });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });
});
