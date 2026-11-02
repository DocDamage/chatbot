import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { sanitizeInput } from '../../middleware/validator';
import { AgentOperationsConsoleService } from '../../core/agent-operations';
import { AgentTeamRole } from '../../core/coding/teams/AgentTeamRoles';

const consoleService = new AgentOperationsConsoleService();

function boundedText(value: unknown, fallback: string, maxLength = 200): string {
  const sanitized = sanitizeInput(String(value ?? fallback)).trim();
  return (sanitized || fallback).slice(0, maxLength);
}

export function createAgentOperationsRouter(): Router {
  const router = Router();

  router.get('/api/agent-operations/summary', asyncHandler(async (req, res) => {
    const projectId = boundedText(req.query.projectId, 'default-project');
    res.json(consoleService.getConsoleSummary(projectId));
  }));

  router.get('/api/agent-operations/sessions/:sessionId', asyncHandler(async (req, res) => {
    const sessionId = boundedText(req.params.sessionId, '', 256);
    const session = consoleService.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Agent session not found.' });
    res.json({ session, events: consoleService.getSessionEvents(sessionId) });
  }));

  router.post('/api/agent-operations/sessions', asyncHandler(async (req, res) => {
    const agentId = boundedText(req.body.agentId, 'managed-agent');
    const projectId = boundedText(req.body.projectId, 'default-project');
    const ownerId = req.user?.userId || boundedText(req.body.ownerId, 'local-operator');
    const allowedRoles = new Set<AgentTeamRole>([
      'planner', 'implementer', 'reviewer', 'security_reviewer', 'integration_supervisor',
      'repository_analyst', 'test_author'
    ]);
    const requestedRole = boundedText(req.body.role, 'implementer');
    if (!allowedRoles.has(requestedRole as AgentTeamRole)) {
      return res.status(400).json({ error: `Unsupported agent role '${requestedRole}'.` });
    }

    const session = consoleService.startSession({
      agentId,
      projectId,
      ownerId,
      role: requestedRole as AgentTeamRole,
      providerClient: 'internal_agent',
      permissions: {
        readOnly: req.body.readOnly === true,
        requiresApprovalForMutation: true,
        allowedTools: Array.isArray(req.body.allowedTools)
          ? req.body.allowedTools.slice(0, 50).map((tool: unknown) => boundedText(tool, '', 100)).filter(Boolean)
          : ['read_file', 'list_files'],
        allowedScopes: Array.isArray(req.body.allowedScopes)
          ? req.body.allowedScopes.slice(0, 50).map((scope: unknown) => boundedText(scope, '', 300)).filter(Boolean)
          : ['*']
      }
    });
    res.status(201).json({ session });
  }));

  router.post('/api/agent-operations/sessions/:sessionId/pause', asyncHandler(async (req, res) => {
    const sessionId = boundedText(req.params.sessionId, '', 256);
    if (!consoleService.getSession(sessionId)) return res.status(404).json({ error: 'Agent session not found.' });
    consoleService.pauseSession(sessionId, boundedText(req.body.reason, 'Operator requested pause'));
    res.json({ session: consoleService.getSession(sessionId) });
  }));

  router.post('/api/agent-operations/sessions/:sessionId/resume', asyncHandler(async (req, res) => {
    const sessionId = boundedText(req.params.sessionId, '', 256);
    if (!consoleService.getSession(sessionId)) return res.status(404).json({ error: 'Agent session not found.' });
    consoleService.resumeSession(sessionId);
    res.json({ session: consoleService.getSession(sessionId) });
  }));

  router.post('/api/agent-operations/stop-all', asyncHandler(async (req, res) => {
    const projectId = boundedText(req.body.projectId, 'default-project');
    const requiredScope = `STOP_ALL_AGENT_SESSIONS:${projectId}`;
    if (req.body.confirmedScope !== requiredScope) {
      return res.status(400).json({
        error: `Emergency stop requires exact-scope confirmation matching '${requiredScope}'.`,
        requiredScope
      });
    }
    const cancelledCount = consoleService.stopAll(projectId, boundedText(req.body.reason, 'Operator triggered emergency stop-all'));
    res.json({ success: true, projectId, cancelledCount });
  }));

  return router;
}

export function resetAgentOperationsForTests(): void {
  consoleService.stopAll(undefined, 'Test reset');
}
