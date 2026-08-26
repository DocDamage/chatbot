import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createMediaAccessibilityRouter } from '../mediaAccessibilityRoutes';

describe('RT-MEDIA-001: Media Accessibility & Dubbing Studio Routes Suite', () => {
  let tempDir: string;
  let app: express.Application;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-accessibility-test-'));
    fs.mkdirSync(path.join(tempDir, 'data', 'media'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'data', 'media', 'sample.mp4'), Buffer.alloc(100));

    app = express();
    app.use(express.json());
    app.use(createMediaAccessibilityRouter(tempDir, {
      autoDiscover: false,
      aiBackend: null,
      runtimes: {
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

  it('reports system status and native capabilities', async () => {
    const res = await request(app).get('/api/media-accessibility/status');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.capabilities).toContain('subtitle_export');
  });

  it('manages project creation with rights confirmation and retrieval', async () => {
    // Missing rights confirmation
    const missingRights = await request(app)
      .post('/api/media-accessibility/projects')
      .send({ title: 'My Video', sourceFilePath: 'data/media/sample.mp4' });
    expect(missingRights.status).toBe(400);

    // Valid project creation
    const created = await request(app)
      .post('/api/media-accessibility/projects')
      .send({
        title: 'Documentary',
        sourceFilePath: 'data/media/sample.mp4',
        originalLanguage: 'en',
        durationSec: 120,
        rightsConfirmed: true
      });
    expect(created.status).toBe(201);
    expect(created.body.projectId).toBeDefined();

    // Get project by ID
    const fetched = await request(app).get(`/api/media-accessibility/projects/${created.body.projectId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.title).toBe('Documentary');

    // Missing project returns 404
    const notFound = await request(app).get('/api/media-accessibility/projects/nonexistent-project');
    expect(notFound.status).toBe(404);
  });

  it('exports subtitles in SRT, WebVTT, ASS, and plain TXT formats', async () => {
    const testCues = [
      { id: 'cue-1', startSec: 1.0, endSec: 3.5, text: 'Hello, welcome to this video.' },
      { id: 'cue-2', startSec: 4.0, endSec: 7.0, text: 'We are discussing AI media tools.' }
    ];

    // SRT
    const srt = await request(app)
      .post('/api/media-accessibility/export-subtitles')
      .send({ cues: testCues, format: 'srt' });
    expect(srt.status).toBe(200);
    expect(srt.body.content).toContain('00:00:01,000 --> 00:00:03,500');

    // VTT
    const vtt = await request(app)
      .post('/api/media-accessibility/export-subtitles')
      .send({ cues: testCues, format: 'vtt' });
    expect(vtt.status).toBe(200);
    expect(vtt.body.content).toContain('WEBVTT');

    // ASS
    const ass = await request(app)
      .post('/api/media-accessibility/export-subtitles')
      .send({ cues: testCues, format: 'ass', title: 'Subbed Video' });
    expect(ass.status).toBe(200);
    expect(ass.body.content).toContain('[Script Info]');

    // TXT
    const txt = await request(app)
      .post('/api/media-accessibility/export-subtitles')
      .send({ cues: testCues, format: 'txt' });
    expect(txt.status).toBe(200);
    expect(txt.body.content).toContain('Hello, welcome to this video.');
  });

  it('aligns transcripts and checks input validations', async () => {
    // Missing transcriptText
    const missing = await request(app).post('/api/media-accessibility/align-transcript').send({});
    expect(missing.status).toBe(400);

    // Valid alignment
    const aligned = await request(app)
      .post('/api/media-accessibility/align-transcript')
      .send({
        transcriptText: 'Sentence one. Sentence two.',
        totalDurationSec: 10,
        speakerId: 'speaker-1'
      });
    expect(aligned.status).toBe(200);
    expect(aligned.body.cues.length).toBeGreaterThan(0);
  });

  it('validates OCR, translation, dubbing, and narration failure-closed behaviors when backends are missing', async () => {
    // OCR without cropRegion
    const ocrNoCrop = await request(app).post('/api/media-accessibility/ocr').send({});
    expect(ocrNoCrop.status).toBe(400);

    // OCR unavailable
    const ocrUnavail = await request(app).post('/api/media-accessibility/ocr').send({
      cropRegion: { x: 0, y: 0.8, width: 1, height: 0.2 }
    });
    expect(ocrUnavail.status).toBe(503);

    // Translation variants
    const transMissing = await request(app).post('/api/media-accessibility/translation-variant').send({});
    expect(transMissing.status).toBe(400);

    const transUnavail = await request(app).post('/api/media-accessibility/translation-variant').send({
      targetLanguage: 'es',
      sourceCues: [{ id: '1', startSec: 0, endSec: 2, text: 'Hello' }]
    });
    expect(transUnavail.status).toBe(503);

    // Dubbing
    const dubMissing = await request(app).post('/api/media-accessibility/dubbing').send({});
    expect(dubMissing.status).toBe(400);

    const dubUnavail = await request(app).post('/api/media-accessibility/dubbing').send({
      cues: [{ id: '1', startSec: 0, endSec: 2, text: 'Hello' }]
    });
    expect(dubUnavail.status).toBe(503);

    // Document narration
    const docMissing = await request(app).post('/api/media-accessibility/document-narration').send({});
    expect(docMissing.status).toBe(400);

    const docUnavail = await request(app).post('/api/media-accessibility/document-narration').send({
      documentText: 'Chapter 1: Intro\nSome text.'
    });
    expect(docUnavail.status).toBe(503);
  });

  it('generates synchronized read-along packages, URL ingest preflight, and cleans storage', async () => {
    // Read along
    const readAlongMissing = await request(app).post('/api/media-accessibility/read-along').send({});
    expect(readAlongMissing.status).toBe(400);

    const readAlong = await request(app)
      .post('/api/media-accessibility/read-along')
      .send({
        title: 'Story Book',
        text: 'Once upon a time in a digital landscape.',
        totalDurationSec: 15
      });
    expect(readAlong.status).toBe(200);
    expect(readAlong.body.epubSmilXml).toBeDefined();

    // Ingest preflight
    const preflight = await request(app)
      .post('/api/media-accessibility/ingest/preflight')
      .send({
        sourceUrl: 'https://example.com/video.mp4',
        userRightsConfirmed: true
      });
    expect(preflight.status).toBe(200);
    expect(preflight.body).toHaveProperty('valid');

    // Storage cleanup (jobId and purgeAll)
    const cleanJob = await request(app)
      .post('/api/media-accessibility/storage/cleanup')
      .send({ jobId: 'job-123' });
    expect(cleanJob.status).toBe(200);

    const purge = await request(app)
      .post('/api/media-accessibility/storage/cleanup')
      .send({});
    expect(purge.status).toBe(200);
  });
});
