import express from 'express';
import request from 'supertest';
import { createMediaAccessibilityRouter } from '../media-accessibility';

describe('media accessibility status route', () => {
  it('reports the truthful local capability and consent boundaries', async () => {
    const app = express();
    app.use(express.json());
    app.use(createMediaAccessibilityRouter(process.cwd()));

    const response = await request(app).get('/api/media-accessibility/status').expect(200);
    expect(response.body).toMatchObject({
      available: true,
      localOnly: true,
      rightsConfirmationRequired: true,
      voiceConsentRequired: true
    });
    expect(response.body.capabilities).toEqual(expect.arrayContaining(['subtitle_ocr', 'consent_gated_dubbing', 'document_narration']));
  });
});
