import path from 'node:path';
import { Router } from 'express';
import { TaskArtifactStore } from '../../core/tasks/TaskArtifactStore';

export function createTaskArtifactsRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const store = new TaskArtifactStore(workspaceRoot);

  router.get('/:sessionId/:fileName', (req, res) => {
    const artifactPath = store.resolve(req.params.sessionId, req.params.fileName);
    if (!artifactPath) {
      return res.status(404).json({ error: 'Task artifact not found.' });
    }

    const extension = path.extname(artifactPath).toLowerCase();
    if (extension === '.html') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'");
      res.type('html');
      return res.sendFile(artifactPath);
    }
    if (extension === '.svg') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
      res.type('image/svg+xml');
      return res.sendFile(artifactPath);
    }

    return res.download(artifactPath, path.basename(artifactPath));
  });

  return router;
}
