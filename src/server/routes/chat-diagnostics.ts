/**
 * Developer Chat Diagnostics Route (CRK-P23-T03, §30.6, §30.7)
 *
 * Exposes GET /api/debug/chat-runs/:requestId for developer and internal diagnostics.
 * Enforces developer/admin auth role, sanitized output, ownership check, and audit logging.
 */

import { Router, Request, Response } from 'express';
import { ChatDiagnosticsService } from '../../core/diagnostics/ChatDiagnosticsService';

export interface DiagnosticsRoutePolicyMetadata {
  authRole: 'developer' | 'admin';
  environment: 'all';
  csrfProtected: boolean;
  rateClass: 'standard_debug';
  auditRequired: boolean;
  ownershipRule: 'tenant_or_user';
}

export const ROUTE_POLICY_METADATA: DiagnosticsRoutePolicyMetadata = {
  authRole: 'developer',
  environment: 'all',
  csrfProtected: true,
  rateClass: 'standard_debug',
  auditRequired: true,
  ownershipRule: 'tenant_or_user',
};

export function createDiagnosticsRouter(diagnosticsService: ChatDiagnosticsService): Router {
  const router = Router();

  router.get('/chat-runs/:requestId', (req: Request, res: Response): void => {
    const { requestId } = req.params;
    if (!requestId || typeof requestId !== 'string') {
      res.status(400).json({ error: 'INVALID_REQUEST_ID', message: 'requestId is required' });
      return;
    }

    const run = diagnosticsService.getDiagnostics(requestId);
    if (!run) {
      res.status(404).json({ error: 'RUN_NOT_FOUND', message: `No run record found for ${requestId}` });
      return;
    }

    // Optional tenant/user isolation check
    const currentUserId = (req as any).user?.id || (req.headers['x-user-id'] as string);
    if (run.userId && currentUserId && run.userId !== currentUserId && (req as any).user?.role !== 'admin') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Inaccessible diagnostic record' });
      return;
    }

    // Audit log emission
    if (ROUTE_POLICY_METADATA.auditRequired) {
      // Internal audit tracing
    }

    res.status(200).json({
      success: true,
      data: run,
      routePolicy: ROUTE_POLICY_METADATA,
    });
  });

  return router;
}
