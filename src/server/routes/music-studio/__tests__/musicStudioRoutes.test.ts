import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMusicStudioRouter } from '../musicStudioRoutes';

describe('RT-MUSIC-001: Music Studio API Routes Suite', () => {
  let tempDir: string;
  let app: express.Application;
  let sampleAudioRel: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-studio-test-'));
    fs.mkdirSync(path.join(tempDir, 'audio'), { recursive: true });
    const audioPath = path.join(tempDir, 'audio', 'sample.wav');
    const sampleDataSize = 400;
    const header = Buffer.alloc(44 + sampleDataSize);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + sampleDataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(2, 22); // Stereo
    header.writeUInt32LE(44100, 24); // 44.1kHz
    header.writeUInt32LE(44100 * 4, 28); // Byte rate
    header.writeUInt16LE(4, 32); // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write('data', 36);
    header.writeUInt32LE(sampleDataSize, 40);
    fs.writeFileSync(audioPath, header);
    sampleAudioRel = 'audio/sample.wav';

    app = express();
    app.use(express.json());
    app.use(createMusicStudioRouter(tempDir, {
      autoDiscover: false,
      runtimes: {
        demucs: 'mock-demucs',
        ffmpeg: 'mock-ffmpeg',
        ffprobe: 'mock-ffprobe',
        ollamaEndpoint: 'http://127.0.0.1:11434'
      }
    }));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('probes hardware acceleration', async () => {
    const res = await request(app).get('/api/music-studio/hardware-probe');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('workerAvailable');
  });

  it('runs rights preflight validation on audio files', async () => {
    // Missing filePath
    const missing = await request(app).post('/api/music-studio/preflight').send({});
    expect(missing.status).toBe(400);

    // Valid preflight
    const valid = await request(app)
      .post('/api/music-studio/preflight')
      .send({
        filePath: sampleAudioRel,
        rights: {
          hasExplicitUserConsent: true,
          declarationText: 'I own this audio recording.',
          processingLocation: 'local_only',
          declaredAt: new Date().toISOString()
        },
        requestedStems: ['vocals', 'drums']
      });
    expect(valid.status).toBe(200);
    expect(valid.body.valid).toBe(true);
  });

  it('handles stem separation job lifecycle, queries, and cancellation', async () => {
    // Separate without filePath
    const missing = await request(app).post('/api/music-studio/separate').send({});
    expect(missing.status).toBe(400);

    // Start separation job
    const started = await request(app)
      .post('/api/music-studio/separate')
      .send({
        filePath: sampleAudioRel,
        rights: {
          hasExplicitUserConsent: true,
          declarationText: 'I own this audio recording.',
          processingLocation: 'local_only',
          declaredAt: new Date().toISOString()
        },
        requestedStems: ['vocals', 'drums', 'bass', 'other'],
        modelName: 'htdemucs',
        generateBackingTrack: true
      });

    expect(started.status).toBe(200);
    expect(started.body.jobId).toBeDefined();
    const jobId = started.body.jobId;

    // Get job status
    const status = await request(app).get(`/api/music-studio/jobs/${jobId}`);
    expect(status.status).toBe(200);
    expect(status.body.jobId).toBe(jobId);

    // Cancel job
    const cancel = await request(app).post(`/api/music-studio/jobs/${jobId}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.jobId).toBe(jobId);

    // Missing job returns 404
    const notFound = await request(app).get('/api/music-studio/jobs/nonexistent-job-123');
    expect(notFound.status).toBe(404);
  });

  it('generates waveform summary and mixer state', async () => {
    // Waveform missing path
    const missing = await request(app).get('/api/music-studio/waveform');
    expect(missing.status).toBe(400);

    // Waveform valid
    const waveform = await request(app)
      .get('/api/music-studio/waveform')
      .query({ path: sampleAudioRel, stemType: 'vocals', points: 64 });
    expect(waveform.status).toBe(200);
    expect(waveform.body).toHaveProperty('pointCount');

    // Init mixer
    const mixerInit = await request(app)
      .post('/api/music-studio/mixer/init')
      .send({ sessionId: 'session-1', stems: ['vocals', 'drums'] });
    expect(mixerInit.status).toBe(200);
    expect(mixerInit.body.sessionId).toBe('session-1');

    // Calculate gains
    const gainsMissing = await request(app).post('/api/music-studio/mixer/calculate-gains').send({});
    expect(gainsMissing.status).toBe(400);

    const gains = await request(app)
      .post('/api/music-studio/mixer/calculate-gains')
      .send({
        channels: {
          vocals: { volume: 0.8, pan: -0.2, muted: false, solo: false },
          drums: { volume: 1.0, pan: 0.2, muted: false, solo: false }
        }
      });
    expect(gains.status).toBe(200);
    expect(gains.body.effectiveGains).toBeDefined();
  });

  it('analyzes tracks, exports stem packages, and produces DAW handoff configurations', async () => {
    // Track analysis
    const analysisMissing = await request(app).post('/api/music-studio/analyze').send({});
    expect(analysisMissing.status).toBe(400);

    const analysis = await request(app)
      .post('/api/music-studio/analyze')
      .send({ filePath: sampleAudioRel });
    expect(analysis.status).toBe(200);
    expect(analysis.body).toHaveProperty('bpm');

    // Export package
    const exportBadName = await request(app)
      .post('/api/music-studio/export')
      .send({
        outputDir: 'audio/exports',
        projectName: 'Unsafe/Project/Name!',
        stems: [{ stemType: 'vocals', filePath: sampleAudioRel, durationSeconds: 30 }]
      });
    expect(exportBadName.status).toBe(400);

    const exportValid = await request(app)
      .post('/api/music-studio/export')
      .send({
        outputDir: 'audio/exports',
        projectName: 'MyProject',
        stems: [{ stemType: 'vocals', filePath: sampleAudioRel, durationSeconds: 30 }],
        mixerChannels: { vocals: { volume: 1, pan: 0, muted: false, solo: false } },
        analysis: analysis.body
      });
    expect(exportValid.status).toBe(200);
    expect(exportValid.body.success).toBe(true);

    // DAW Handoff
    const dawMissing = await request(app).post('/api/music-studio/daw-handoff').send({});
    expect(dawMissing.status).toBe(400);

    const daw = await request(app)
      .post('/api/music-studio/daw-handoff')
      .send({
        stems: [{ stemType: 'vocals', filePath: sampleAudioRel, durationSeconds: 30 }],
        tempoBpm: 128,
        dawName: 'FL Studio'
      });
    expect(daw.status).toBe(200);
    expect(daw.body.layout).toBeDefined();
    expect(daw.body.flStudioScript).toContain('FL Studio');
  });
});
