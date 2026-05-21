import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { FileExplorerService, FileSearchKind } from '../../core/files/FileExplorerService';

const audioContentTypes: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4'
};

const imageContentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

export function createFilesRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const files = new FileExplorerService(workspaceRoot);

  router.get('/api/files/tree', asyncHandler(async (req, res) => {
    res.json(await files.getTree(String(req.query.root || '.'), Number(req.query.maxDepth || 4)));
  }));

  router.get('/api/files/search', asyncHandler(async (req, res) => {
    const q = String(req.query.q || '');
    if (!q.trim()) return res.status(400).json({ error: 'q is required' });
    res.json(await files.search(q, String(req.query.kind || 'both') as FileSearchKind, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      maxFiles: req.query.maxFiles ? Number(req.query.maxFiles) : undefined,
      maxContentBytes: req.query.maxContentBytes ? Number(req.query.maxContentBytes) : undefined
    }));
  }));

  router.get('/api/files/read', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(await files.readFile(
      filePath,
      req.query.startLine ? Number(req.query.startLine) : undefined,
      req.query.endLine ? Number(req.query.endLine) : undefined
    ));
  }));

  router.get('/api/files/preview/audio', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    const absolute = resolveWorkspacePath(workspaceRoot, filePath);
    const stats = fs.statSync(absolute);
    if (!stats.isFile()) return res.status(400).json({ error: 'path must point to a file' });
    const contentType = audioContentTypes[path.extname(absolute).toLowerCase()];
    if (!contentType) return res.status(415).json({ error: 'Unsupported audio preview type' });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    fs.createReadStream(absolute).pipe(res);
  }));

  router.get('/api/files/preview/image', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    const absolute = resolveWorkspacePath(workspaceRoot, filePath);
    const stats = fs.statSync(absolute);
    if (!stats.isFile()) return res.status(400).json({ error: 'path must point to a file' });
    const contentType = imageContentTypes[path.extname(absolute).toLowerCase()];
    if (!contentType) return res.status(415).json({ error: 'Unsupported image preview type' });
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(absolute).pipe(res);
  }));

  router.get('/api/files/metadata', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    if (!filePath.trim()) return res.status(400).json({ error: 'path is required' });
    res.json(await files.metadata(filePath));
  }));

  router.post('/api/files/load-into-chat', asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body.files) ? req.body.files : [];
    res.json({ loadedFiles: await files.loadIntoChat(items) });
  }));

  return router;
}

function resolveWorkspacePath(workspaceRoot: string, requestedPath: string): string {
  const root = path.resolve(workspaceRoot);
  const absolute = path.resolve(root, requestedPath || '.');
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error('Path resolves outside workspace');
  }
  return absolute;
}
