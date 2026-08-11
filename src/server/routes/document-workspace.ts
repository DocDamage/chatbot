import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { DocumentReviewService } from '../../core/documents/DocumentReviewService';

export function createDocumentWorkspaceRouter(services: any, workspaceRoot = process.cwd()): Router {
  const router = Router();
  const reviewService = new DocumentReviewService();
  const draftRoot = path.join(workspaceRoot, 'data', 'document-workspace');
  fs.mkdirSync(draftRoot, { recursive: true });

  router.post('/api/document-workspace/review', asyncHandler(async (req, res) => {
    const title = sanitizeInput(String(req.body.title || 'Untitled document'));
    const content = String(req.body.content || '');
    res.json(reviewService.review(title, content));
  }));

  router.post('/api/document-workspace/transform', asyncHandler(async (req, res) => {
    res.json(reviewService.transform(sanitizeInput(String(req.body.action || '')), String(req.body.content || '')));
  }));

  router.post('/api/document-workspace/save', asyncHandler(async (req, res) => {
    const title = sanitizeInput(String(req.body.title || 'Untitled document'));
    const content = String(req.body.content || '').trim();
    const review = reviewService.verify(String(req.body.token || ''), title, content);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'document';
    const filePath = path.join(draftRoot, `${slug}-${Date.now()}.md`);
    fs.writeFileSync(filePath, `# ${title}\n\n${content}\n`, 'utf8');
    let chunks = 0;
    if (services?.documentManager) {
      const added = await services.documentManager.addText(content, {
        source: `document-workspace:${path.basename(filePath)}`,
        title,
        domain: sanitizeInput(String(req.body.domain || 'general')),
        sourceType: 'reviewed_document',
        tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : [],
        reviewedAt: review.reviewedAt
      });
      chunks = added.length;
    }
    reviewService.consume(review.token);
    res.status(201).json({ saved: true, path: path.relative(workspaceRoot, filePath).replace(/\\/g, '/'), chunks, reviewedAt: review.reviewedAt });
  }));

  return router;
}
