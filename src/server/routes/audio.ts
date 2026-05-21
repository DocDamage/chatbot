import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { AudioLibraryService } from '../../core/audio/AudioLibraryService';

export function createAudioRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const audio = new AudioLibraryService(workspaceRoot);

  router.get('/api/audio/files', asyncHandler(async (req, res) => {
    res.json(await audio.listAudioFiles(String(req.query.root || '.'), String(req.query.q || ''), {
      limit: Number(req.query.limit || 50),
      offset: Number(req.query.offset || 0),
      maxFiles: Number(req.query.maxFiles || 1000)
    }));
  }));

  router.get('/api/audio/metadata', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(await audio.getMetadata(filePath));
  }));

  router.get('/api/audio/preview', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.sendFile(audio.getPreviewPath(filePath));
  }));

  router.get('/api/audio/waveform', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(await audio.getWaveform(filePath, Number(req.query.points || 128)));
  }));

  router.post('/api/audio/load-into-chat', asyncHandler(async (req, res) => {
    const paths = Array.isArray(req.body.paths) ? req.body.paths.map(String) : [];
    res.json({ loadedAudio: await audio.loadIntoChat(paths) });
  }));

  router.post('/api/audio/analyze', asyncHandler(async (req, res) => {
    const filePath = String(req.body?.path || req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(await audio.analyzeAudio(filePath));
  }));

  return router;
}
