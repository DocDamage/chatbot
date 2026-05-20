import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { AudioLibraryService } from '../../core/audio/AudioLibraryService';

export function createAudioRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const audio = new AudioLibraryService(workspaceRoot);

  router.get('/api/audio/files', asyncHandler(async (req, res) => {
    res.json({ files: await audio.listAudioFiles(String(req.query.root || '.'), String(req.query.q || '')) });
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

  router.get('/api/audio/waveform', asyncHandler(async (_req, res) => {
    res.json({ points: [], ffmpegAvailable: false, notice: 'Waveform extraction requires FFmpeg and is not available in fallback mode.' });
  }));

  router.post('/api/audio/load-into-chat', asyncHandler(async (req, res) => {
    const paths = Array.isArray(req.body.paths) ? req.body.paths.map(String) : [];
    res.json({ loadedAudio: await audio.loadIntoChat(paths) });
  }));

  router.post('/api/audio/analyze', asyncHandler(async (_req, res) => {
    res.status(501).json({ error: 'Deeper audio analysis is not enabled yet.' });
  }));

  return router;
}
