import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { createDesktopCompanionRouter } from '../desktop-companion';
import { createGameStudioRouter } from '../game-studio/gameStudioRoutes';
import { createMediaAccessibilityRouter } from '../media-accessibility/mediaAccessibilityRoutes';
import { createMusicStudioRouter } from '../music-studio/musicStudioRoutes';
import { createWritingStudioRouter } from '../writing-studio';

describe('native adapter routes fail closed without configured runtimes', () => {
  let workspaceRoot: string;
  let app: express.Express;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'native-adapter-routes-'));
    app = express();
    app.use(express.json({ limit: '3mb' }));
    app.use(createDesktopCompanionRouter(workspaceRoot, { autoDiscover: false }));
    app.use(createGameStudioRouter(workspaceRoot));
    app.use(createMediaAccessibilityRouter(workspaceRoot, { autoDiscover: false }));
    app.use(createMusicStudioRouter(workspaceRoot, { autoDiscover: false }));
    app.use(createWritingStudioRouter(workspaceRoot, { autoDiscover: false }));
  });

  afterEach(() => fs.rmSync(workspaceRoot, { recursive: true, force: true }));

  it('reports native desktop availability honestly and rejects fabricated capture or dictation', async () => {
    const capabilities = await request(app).get('/api/desktop-companion/capabilities');
    expect(capabilities.status).toBe(200);
    expect(capabilities.body.features).toMatchObject({ localSTT: false, localTTS: false, screenContext: false });

    const dictate = await request(app).post('/api/desktop-companion/dictate').send({ audioBase64: Buffer.from('audio').toString('base64') });
    expect(dictate.status).toBe(503);
    const screen = await request(app).post('/api/desktop-companion/screen-capture').send({ userTriggered: true });
    expect(screen.status).toBe(503);
  });

  it('withholds raw screen pixels by default when only text redaction is available', async () => {
    const screenApp = express();
    screenApp.use(express.json());
    screenApp.use(createDesktopCompanionRouter(workspaceRoot, {
      autoDiscover: false,
      screenCaptureBackend: {
        capture: async () => ({
          imageBuffer: Buffer.from('raw-screen-pixels'),
          dimensions: { width: 100, height: 50 },
          detectedTextSnippets: ['api_key=1234567890abcdef']
        })
      }
    }));

    const protectedCapture = await request(screenApp)
      .post('/api/desktop-companion/screen-capture')
      .send({ userTriggered: true });
    expect(protectedCapture.status).toBe(200);
    expect(protectedCapture.body).toMatchObject({
      rawImageWithheld: true,
      detectedSnippets: ['[REDACTED_SECRET]'],
      redactedCount: 1
    });
    expect(protectedCapture.body.imageBase64).toBeUndefined();

    const explicitRawCapture = await request(screenApp)
      .post('/api/desktop-companion/screen-capture')
      .send({ userTriggered: true, redactSensitiveText: false });
    expect(explicitRawCapture.body).toMatchObject({
      rawImageWithheld: false,
      imageBase64: Buffer.from('raw-screen-pixels').toString('base64')
    });
  });

  it('reports media backends unavailable and returns 503 for provider-dependent actions', async () => {
    const status = await request(app).get('/api/media-accessibility/status');
    expect(status.body.nativeBackends).toEqual({ subtitleOcr: false, translation: false, dubbing: false, narration: false });

    expect((await request(app).post('/api/media-accessibility/ocr').send({ videoPath: 'video.mp4', cropRegion: { x: 0, y: 0, width: 10, height: 10 } })).status).toBe(503);
    expect((await request(app).post('/api/media-accessibility/translation-variant').send({ targetLanguage: 'es', sourceCues: [] })).status).toBe(503);
    expect((await request(app).post('/api/media-accessibility/dubbing').send({ cues: [{ id: '1', index: 1, startSec: 0, endSec: 1, text: 'Source' }] })).status).toBe(503);
    expect((await request(app).post('/api/media-accessibility/document-narration').send({ documentText: 'Source' })).status).toBe(503);
  });

  it('does not start fake music or writing-model work and uses the real built-in asset cooker', async () => {
    const hardware = await request(app).get('/api/music-studio/hardware-probe');
    expect(hardware.body.workerAvailable).toBe(false);
    expect((await request(app).post('/api/music-studio/separate').send({ filePath: 'audio.wav' })).status).toBe(503);
    fs.writeFileSync(path.join(workspaceRoot, 'asset.txt'), 'cook me', 'utf8');
    const cooked = await request(app).post('/api/game-studio/asset-cook').send({ configRoot: '.' });
    expect(cooked.status).toBe(200);
    expect(cooked.body).toMatchObject({ success: true, totalAssets: 1, cookedAssets: 1 });
    expect(fs.existsSync(cooked.body.outputArtifactPath)).toBe(true);

    await request(app).post('/api/writing-studio/documents/open').send({ title: 'Draft', content: 'Source text.' });
    expect((await request(app).post('/api/writing-studio/proposals').send({ action: 'summarize' })).status).toBe(503);
  });
});
