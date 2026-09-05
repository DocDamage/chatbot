import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopCompanionRouter } from '../desktop-companion';

describe('RT-DESK-001: DesktopCompanion API Routes Suite', () => {
  let workspaceRoot: string;
  let app: express.Express;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-companion-test-'));
    app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use(createDesktopCompanionRouter(workspaceRoot, {
      autoDiscover: false,
      runtimes: {
        python: 'mock-python',
        powershell: 'mock-powershell',
        ollamaEndpoint: 'http://127.0.0.1:11434'
      },
      aiBackend: {
        health: jest.fn().mockResolvedValue({ available: true, models: ['qwen3:8b'] }),
        transform: jest.fn().mockResolvedValue('Transformed text output')
      } as any,
      screenCaptureBackend: {
        capture: jest.fn().mockResolvedValue({
          imageBuffer: Buffer.from('mock-screen-image-data'),
          dimensions: { width: 1920, height: 1080 },
          detectedTextSnippets: ['confidential secret key: 12345']
        })
      }
    }));
  });

  afterEach(() => {
    try {
      fs.rmSync(workspaceRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('GET /capabilities returns local companion feature status and packaging', async () => {
    const res = await request(app).get('/api/desktop-companion/capabilities');
    expect(res.status).toBe(200);
    expect(res.body.integration).toBe('optional-local-companion');
    expect(res.body.packaging).toBeDefined();
  });

  it('GET /stt-models and /tts-voices list available models', async () => {
    const stt = await request(app).get('/api/desktop-companion/stt-models');
    expect(stt.status).toBe(200);
    expect(stt.body.models).toBeDefined();

    const tts = await request(app).get('/api/desktop-companion/tts-voices');
    expect(tts.status).toBe(200);
    expect(tts.body.voices).toBeDefined();
  });

  it('POST /synthesize validates text length and required fields', async () => {
    // Missing text
    const empty = await request(app).post('/api/desktop-companion/synthesize').send({});
    expect(empty.status).toBe(400);

    // Text too long
    const hugeText = 'x'.repeat(20005);
    const tooLong = await request(app).post('/api/desktop-companion/synthesize').send({ text: hugeText });
    expect(tooLong.status).toBe(413);
  });

  it('POST /dictate validates audioBase64 presence and size', async () => {
    // Missing audio
    const missing = await request(app).post('/api/desktop-companion/dictate').send({});
    expect(missing.status).toBe(400);

    // Huge audio
    const hugeAudio = Buffer.alloc(11 * 1024 * 1024).toString('base64');
    const tooLarge = await request(app).post('/api/desktop-companion/dictate').send({ audioBase64: hugeAudio });
    expect(tooLarge.status).toBe(413);
  });

  it('POST /screen-capture enforces explicit userTriggered flag', async () => {
    const unverified = await request(app).post('/api/desktop-companion/screen-capture').send({ userTriggered: false });
    expect(unverified.status).toBe(403);

    const verified = await request(app).post('/api/desktop-companion/screen-capture').send({ userTriggered: true });
    expect(verified.status).toBe(200);
    expect(verified.body.rawImageWithheld).toBe(true);
  });

  it('POST /clipboard-action executes supported transformations', async () => {
    // Missing text
    const missing = await request(app).post('/api/desktop-companion/clipboard-action').send({});
    expect(missing.status).toBe(400);

    // Invalid action
    const invalid = await request(app).post('/api/desktop-companion/clipboard-action').send({
      rawClipboardText: 'some text',
      action: 'unsupported_action'
    });
    expect(invalid.status).toBe(400);

    // Valid send_to_chat
    const chatAction = await request(app).post('/api/desktop-companion/clipboard-action').send({
      rawClipboardText: 'Hello from clipboard',
      action: 'send_to_chat'
    });
    expect(chatAction.status).toBe(200);
    expect(chatAction.body.action).toBe('send_to_chat');
  });

  it('GET /briefing generates structured daily briefing', async () => {
    const res = await request(app).get('/api/desktop-companion/briefing');
    expect(res.status).toBe(200);
    expect(res.body.greeting).toBeDefined();
    expect(res.body.date).toBeDefined();
    expect(res.body.hardwareHealth).toBeDefined();
  });

  it('POST /validate-os-action verifies OS action safety', async () => {
    const res = await request(app).post('/api/desktop-companion/validate-os-action').send({
      action: { type: 'launch_app', command: 'notepad.exe' }
    });
    expect(res.status).toBe(200);
  });

  it('manages privacy settings and context log appends', async () => {
    const privacyGet = await request(app).get('/api/desktop-companion/privacy');
    expect(privacyGet.status).toBe(200);

    const privacyPost = await request(app).post('/api/desktop-companion/privacy').send({
      allowScreenCapture: true
    });
    expect(privacyPost.status).toBe(200);

    // Context append
    const emptyCtx = await request(app).post('/api/desktop-companion/context').send({});
    expect(emptyCtx.status).toBe(400);

    const validCtx = await request(app).post('/api/desktop-companion/context').send({
      content: 'Important meeting notes from screen summary',
      kind: 'screen-summary'
    });
    expect(validCtx.status).toBe(201);
    expect(validCtx.body.accepted).toBe(true);
  });
});
