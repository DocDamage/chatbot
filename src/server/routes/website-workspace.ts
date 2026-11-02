/**
 * Phase PX-16: Website Workspace & Web Studio Router
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { WebStudioService } from '../../core/website/WebStudioService';

export function createWebsiteWorkspaceRouter(workspaceRoot = process.cwd()): Router {
  const router = Router();
  const service = new WebStudioService(workspaceRoot);

  // Project & Preview
  router.get('/api/website-workspace/project', (_req, res) => {
    res.json({ project: service.getProject() });
  });

  router.post('/api/website-workspace/project', asyncHandler(async (req, res) => {
    const result = service.saveProject();
    res.status(201).json(result);
  }));

  router.post('/api/website-workspace/preview', asyncHandler(async (req, res) => {
    const html = service.renderPreview({
      slug: req.body.slug,
      viewport: req.body.viewport,
      enableInspectMarkers: req.body.enableInspectMarkers
    });
    res.json({ html });
  }));

  // Block Templates & Editing
  router.get('/api/website-workspace/templates', (_req, res) => {
    res.json({ templates: service.getTemplates() });
  });

  router.post('/api/website-workspace/blocks', asyncHandler(async (req, res) => {
    const { pageId, type, targetIndex } = req.body;
    const block = service.addBlock(pageId, type, targetIndex);
    res.status(201).json({ block });
  }));

  router.patch('/api/website-workspace/blocks/:blockId', asyncHandler(async (req, res) => {
    const { pageId, updates } = req.body;
    const block = service.updateBlock(pageId, req.params.blockId, updates);
    res.json({ block });
  }));

  router.delete('/api/website-workspace/blocks/:blockId', asyncHandler(async (req, res) => {
    const pageId = String(req.query.pageId || req.body.pageId);
    const success = service.deleteBlock(pageId, req.params.blockId);
    res.json({ success });
  }));

  router.post('/api/website-workspace/blocks/:blockId/duplicate', asyncHandler(async (req, res) => {
    const { pageId } = req.body;
    const block = service.duplicateBlock(pageId, req.params.blockId);
    res.status(201).json({ block });
  }));

  router.post('/api/website-workspace/blocks/:blockId/reorder', asyncHandler(async (req, res) => {
    const { pageId, newIndex } = req.body;
    const success = service.reorderBlock(pageId, req.params.blockId, Number(newIndex));
    res.json({ success });
  }));

  router.post('/api/website-workspace/undo', asyncHandler(async (_req, res) => {
    const project = service.undo();
    res.json({ project, canUndo: project !== null });
  }));

  router.post('/api/website-workspace/redo', asyncHandler(async (_req, res) => {
    const project = service.redo();
    res.json({ project, canRedo: project !== null });
  }));

  // Assets
  router.get('/api/website-workspace/assets', (_req, res) => {
    res.json({ assets: service.listAssets(), unused: service.detectUnusedAssets() });
  });

  router.post('/api/website-workspace/assets', asyncHandler(async (req, res) => {
    const asset = service.registerAsset(req.body);
    res.status(201).json({ asset });
  }));

  // Inspector & Source Link
  router.get('/api/website-workspace/inspect', asyncHandler(async (req, res) => {
    const pageId = String(req.query.pageId || '');
    const blockId = String(req.query.blockId || '');
    const inspection = service.inspectElement(pageId, blockId);
    res.json({ inspection });
  }));

  router.post('/api/website-workspace/source-link', asyncHandler(async (req, res) => {
    const location = service.locateSource(req.body);
    res.json({ location });
  }));

  // Visual Edit Proposals
  router.post('/api/website-workspace/proposals', asyncHandler(async (req, res) => {
    const proposal = service.createEditProposal(req.body);
    res.status(201).json({ proposal });
  }));

  router.post('/api/website-workspace/proposals/:id/approve', asyncHandler(async (req, res) => {
    const proposal = service.approveEditProposal(req.params.id, req.body.digest);
    res.json({ proposal });
  }));

  router.post('/api/website-workspace/proposals/:id/apply', asyncHandler(async (req, res) => {
    const result = service.applyEditProposal(req.params.id);
    res.json(result);
  }));

  router.post('/api/website-workspace/transactions/:id/rollback', asyncHandler(async (req, res) => {
    const success = service.rollbackTransaction(req.params.id);
    res.json({ success });
  }));

  // Import / Export / Audit
  router.post('/api/website-workspace/import-html', asyncHandler(async (req, res) => {
    const project = service.importHtml(req.body.html, req.body.name);
    res.status(201).json({ project });
  }));

  router.get('/api/website-workspace/export', asyncHandler(async (_req, res) => {
    const bundle = service.exportBundle();
    const validation = service.validateLinksAndAssets();
    res.json({ bundle, validation });
  }));

  router.get('/api/website-workspace/audit', asyncHandler(async (_req, res) => {
    const report = service.runAccessibilityAudit();
    res.json({ report });
  }));

  return router;
}
