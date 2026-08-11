import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';

export function createDesktopCompanionRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const root = path.join(workspaceRoot, 'data', 'desktop-companion');
  fs.mkdirSync(root, { recursive: true });
  router.get('/api/desktop-companion/capabilities', (_req, res) => res.json({
    integration: 'optional-local-companion',
    available: false,
    features: { voiceInput: true, screenContext: true, pasteIntoApps: true },
    consent: { screenContext: 'explicit-per-request', voiceInput: 'explicit-per-request', persistence: 'off-by-default' },
    message: 'Install or connect a local companion to enable OS-level capture and paste. The browser app never captures the screen automatically.'
  }));
  router.post('/api/desktop-companion/context', asyncHandler(async (req, res) => {
    const kind = req.body.kind === 'screen-summary' ? 'screen-summary' : 'transcript';
    const content = String(req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'context content is required' });
    if (content.length > 20000) return res.status(413).json({ error: 'context content is too large' });
    fs.appendFileSync(path.join(root, 'context.jsonl'), `${JSON.stringify({ kind, content, createdAt: new Date().toISOString() })}\n`, 'utf8');
    return res.status(201).json({ accepted: true, kind, persisted: true });
  }));
  return router;
}
