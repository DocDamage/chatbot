/**
 * CF-09 Unified Capability Hub Test Suite
 */

import { CapabilityRegistry } from './CapabilityRegistry';
import { CapabilityJobManager } from './CapabilityJobManager';

describe('CF-09 Unified Capability Hub', () => {
  let registry: CapabilityRegistry;
  let jobManager: CapabilityJobManager;

  beforeEach(() => {
    registry = CapabilityRegistry.getInstance();
    registry.clearOverrides();
    jobManager = CapabilityJobManager.getInstance();
    jobManager.clear();
  });

  describe('Capability Registry inventory and classification', () => {
    it('returns all defined capabilities across core, coding, agents, multimodal, and gaming', () => {
      const capabilities = registry.getCapabilities('local', 'developer');
      expect(capabilities.length).toBeGreaterThanOrEqual(10);

      const ids = capabilities.map(c => c.id);
      expect(ids).toContain('repo_architecture');
      expect(ids).toContain('hybrid_retrieval');
      expect(ids).toContain('repository_findings');
      expect(ids).toContain('local_model_adapter');
      expect(ids).toContain('typed_agent_teams');
      expect(ids).toContain('browser_jobs');
      expect(ids).toContain('video_localization');
      expect(ids).toContain('lattice_gamedev');
    });

    it('classifies capabilities into valid sections', () => {
      const capabilities = registry.getCapabilities('local', 'developer');
      const validSections = [
        'available_now',
        'needs_setup',
        'local_only',
        'preview',
        'disabled_by_policy',
        'unhealthy_degraded'
      ];

      for (const cap of capabilities) {
        expect(validSections).toContain(cap.section);
        expect(cap.authorityAndEgress).toBeDefined();
        expect(cap.estimatedCostAndResources).toBeDefined();
        expect(cap.dataRetentionPolicy).toBeDefined();
        expect(cap.supportStatusAndLimitations.length).toBeGreaterThan(0);
      }
    });

    it('enforces hosted deployment profile restrictions on local-only capabilities', () => {
      const hostedCapabilities = registry.getCapabilities('hosted', 'developer');
      const localOnly = hostedCapabilities.filter(c => c.localOnly);

      for (const item of localOnly) {
        expect(item.section).toBe('disabled_by_policy');
        expect(item.healthState).toBe('disabled');
        expect(item.diagnostics?.isBlocked).toBe(true);
        expect(item.actions).toEqual([]);
      }
    });

    it('filters admin-only actions from standard users', () => {
      const userCaps = registry.getCapabilities('local', 'user');
      const agentTeams = userCaps.find(c => c.id === 'typed_agent_teams');
      expect(agentTeams).toBeDefined();
      expect(agentTeams?.actions.some(a => a.id === 'disable_capability')).toBe(false);

      const adminCaps = registry.getCapabilities('local', 'admin');
      const adminAgentTeams = adminCaps.find(c => c.id === 'typed_agent_teams');
      expect(adminAgentTeams?.actions.some(a => a.id === 'disable_capability')).toBe(true);
    });
  });

  describe('Capability action execution and exact-scope confirmation', () => {
    it('executes a safe diagnostic canary action and creates a verified job', async () => {
      const result = await registry.executeAction('lattice_gamedev', 'test_run', {
        requester: 'TestRunner',
        userRole: 'developer'
      });

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
      expect(result.job?.status).toBe('completed');
      expect(result.job?.evidence.length).toBeGreaterThan(0);
      expect(result.job?.auditDigest).toBeDefined();
    });

    it('blocks dangerous actions without exact-scope confirmation', async () => {
      const result = await registry.executeAction('typed_agent_teams', 'disable_capability', {
        confirmedScope: 'WRONG_SCOPE',
        userRole: 'admin'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('exact-scope confirmation');
    });

    it('allows dangerous actions when exact-scope confirmation matches', async () => {
      const result = await registry.executeAction('typed_agent_teams', 'disable_capability', {
        confirmedScope: 'DISABLE_AGENT_TEAMS',
        userRole: 'admin'
      });

      expect(result.success).toBe(true);

      const cap = registry.getCapabilityById('typed_agent_teams');
      expect(cap?.healthState).toBe('disabled');
      expect(cap?.section).toBe('disabled_by_policy');

      // Reset
      await registry.executeAction('typed_agent_teams', 'enable_capability', { userRole: 'admin' });
      const resetCap = registry.getCapabilityById('typed_agent_teams');
      expect(resetCap?.healthState).toBe('degraded');
    });
  });

  describe('Capability Job Lifecycle & Audit Trail', () => {
    it('tracks job lifecycle from registration, progress, evidence, to completion', () => {
      const job = jobManager.registerJob({
        capabilityId: 'browser_jobs',
        category: 'browser',
        title: 'E2E QA Run',
        requester: 'QAEvaluation'
      });

      expect(job.status).toBe('running');
      expect(job.auditDigest).toBeDefined();

      jobManager.updateProgress(job.id, 50);
      expect(jobManager.getJob(job.id)?.progressPercent).toBe(50);

      const added = jobManager.addEvidence(job.id, {
        type: 'screenshot',
        description: 'Homepage capture',
        path: '/tmp/screenshot.png'
      });
      expect(added).toBe(true);

      jobManager.completeJob(job.id);
      const completed = jobManager.getJob(job.id);
      expect(completed?.status).toBe('completed');
      expect(completed?.progressPercent).toBe(100);
      expect(completed?.completedAt).toBeDefined();
    });

    it('supports job cancellation with reason and audit update', () => {
      const job = jobManager.registerJob({
        capabilityId: 'video_localization',
        category: 'video_localization',
        title: 'Dubbing job',
        requester: 'Operator'
      });

      const cancelled = jobManager.cancelJob(job.id, 'User cancelled processing');
      expect(cancelled).toBe(true);

      const current = jobManager.getJob(job.id);
      expect(current?.status).toBe('cancelled');
      expect(current?.fallbackReason).toBe('User cancelled processing');
    });
  });
});
