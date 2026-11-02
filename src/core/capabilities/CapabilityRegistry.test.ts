/**
 * CF-09 Unified Capability Hub Test Suite
 */

import { CapabilityRegistry } from './CapabilityRegistry';
import { CapabilityJobManager } from './CapabilityJobManager';
import { LocalModelDiscovery } from '../providers/local/LocalModelDiscovery';

describe('CF-09 Unified Capability Hub', () => {
  let registry: CapabilityRegistry;
  let jobManager: CapabilityJobManager;

  beforeEach(() => {
    registry = CapabilityRegistry.getInstance();
    registry.clearOverrides();
    jobManager = CapabilityJobManager.getInstance();
    jobManager.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LOCAL_MODEL_ENABLED;
    delete process.env.LOCAL_MODEL_BASE_URL;
    delete process.env.LOCAL_MODEL_PROVIDER_NAME;
    delete process.env.LOCAL_MODEL_API_KEY;
    delete process.env.LOCAL_MODEL_ALLOWLIST;
    delete process.env.LOCAL_MODEL_TIMEOUT_MS;
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
      expect(ids).toEqual(expect.arrayContaining([
        'context_economy',
        'project_memory',
        'agent_operations',
        'game_engine_bridge',
        'sprite_studio',
        'stem_mix_lab',
        'desktop_voice_companion',
        'media_accessibility',
        'writing_studio',
        'study_studio',
        'web_studio',
        'developer_utility_pack'
      ]));
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

    it('applies maturity overrides and exposes restoration only to administrators', async () => {
      registry.updateCapabilityMaturity('browser_jobs', 'DEPRECATED');
      expect(registry.getCapabilityById('browser_jobs', 'local', 'developer')?.maturity).toBe('DEPRECATED');

      await registry.executeAction('typed_agent_teams', 'disable_capability', {
        confirmedScope: 'DISABLE_AGENT_TEAMS', userRole: 'admin'
      });
      expect(registry.getCapabilityById('typed_agent_teams', 'local', 'developer')?.actions)
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'enable_capability' })]));
      expect(registry.getCapabilityById('typed_agent_teams', 'local', 'admin')?.actions)
        .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'enable_capability' })]));
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

    it('fails closed for unknown capabilities, unavailable actions, and unhandled actions', async () => {
      await expect(registry.executeAction('missing', 'test_run')).resolves.toMatchObject({
        success: false, message: expect.stringContaining('not found')
      });
      await expect(registry.executeAction('browser_jobs', 'missing')).resolves.toMatchObject({
        success: false, message: expect.stringContaining('not available')
      });

      (registry as any).capabilityOverrides.set('repo_architecture', {
        actions: [{ id: 'open_settings', label: 'Open settings', description: 'No execution handler' }]
      });
      await expect(registry.executeAction('repo_architecture', 'open_settings')).resolves.toMatchObject({
        success: false, message: expect.stringContaining('No executable handler')
      });
    });

    it('runs the team, browser, localization, and lattice contract diagnostics', async () => {
      for (const capabilityId of ['typed_agent_teams', 'browser_jobs', 'video_localization', 'lattice_gamedev']) {
        const result = await registry.executeAction(capabilityId, 'test_run', { requester: 'CoverageOperator' });
        expect(result.success).toBe(true);
        expect(result.job?.status).toBe('completed');
        expect(result.job?.evidence).toHaveLength(1);
      }

      expect(jobManager.listJobs({ capabilityId: 'typed_agent_teams' })[0].category).toBe('agent_teams');
      expect(jobManager.listJobs({ capabilityId: 'video_localization' })[0].category).toBe('video_localization');
      expect(jobManager.listJobs({ capabilityId: 'lattice_gamedev' })[0].category).toBe('lattice_gamedev');
    });

    it('records unsupported diagnostics as failed jobs', async () => {
      const result = await registry.executeAction('repository_findings', 'test_run');
      expect(result.success).toBe(false);
      expect(result.message).toContain('does not yet have a verified diagnostic handler');
      expect(result.job).toMatchObject({ status: 'failed', category: 'findings_analysis' });
    });

    it('verifies exposure contracts for every newly surfaced expansion family', async () => {
      const capabilityIds = [
        'context_economy', 'project_memory', 'agent_operations', 'game_engine_bridge',
        'desktop_voice_companion', 'media_accessibility', 'writing_studio',
        'study_studio', 'web_studio', 'developer_utility_pack'
      ];

      for (const capabilityId of capabilityIds) {
        const result = await registry.executeAction(capabilityId, 'test_run', { requester: 'ExpansionContractTest' });
        expect(result.success).toBe(true);
        expect(result.job?.evidence[0]).toMatchObject({
          type: 'capability_exposure_contract',
          dataPreview: { capabilityId, liveExternalCanary: false }
        });
      }
    });

    it('reports local-model setup failures without claiming a successful canary', async () => {
      process.env.LOCAL_MODEL_ENABLED = 'false';
      let result = await registry.executeAction('local_model_adapter', 'run_canary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('LOCAL_MODEL_ENABLED is false');

      process.env.LOCAL_MODEL_ENABLED = 'true';
      result = await registry.executeAction('local_model_adapter', 'run_canary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('LOCAL_MODEL_BASE_URL is not configured');
    });

    it('promotes local-model health only after a healthy live probe response', async () => {
      process.env.LOCAL_MODEL_ENABLED = 'true';
      process.env.LOCAL_MODEL_BASE_URL = 'http://127.0.0.1:11434/v1';
      process.env.LOCAL_MODEL_PROVIDER_NAME = 'fixture-provider';
      process.env.LOCAL_MODEL_ALLOWLIST = '127.0.0.1, localhost';
      process.env.LOCAL_MODEL_TIMEOUT_MS = '250';
      const probe = jest.spyOn(LocalModelDiscovery.prototype, 'probeEndpoint');
      probe.mockResolvedValueOnce({
        provider: 'fixture-provider', baseUrl: process.env.LOCAL_MODEL_BASE_URL,
        health: 'incompatible', models: [], lastChecked: '2026-08-25T12:00:00.000Z', error: 'probe rejected'
      });
      let result = await registry.executeAction('local_model_adapter', 'run_canary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('probe rejected');

      probe.mockResolvedValueOnce({
        provider: 'fixture-provider', baseUrl: process.env.LOCAL_MODEL_BASE_URL,
        health: 'healthy', models: [{
          id: 'fixture-model', name: 'Fixture Model', contextLength: 4096,
          supportsStreaming: true, supportsEmbeddings: false, supportsVision: false,
          supportsTools: true, supportsStructuredOutput: true, codeQuality: 0.8,
          latencyMs: 20, costPer1kTokens: 0
        }],
        version: '1.0', lastChecked: '2026-08-25T12:01:00.000Z'
      });
      result = await registry.executeAction('local_model_adapter', 'run_canary');
      expect(result.success).toBe(true);
      expect(result.job?.evidence[0].dataPreview).toMatchObject({
        provider: 'fixture-provider', health: 'healthy', version: '1.0', modelCount: 1
      });
      expect(registry.getCapabilityById('local_model_adapter')?.healthState).toBe('healthy');
      expect(probe).toHaveBeenLastCalledWith(process.env.LOCAL_MODEL_BASE_URL, expect.objectContaining({
        providerName: 'fixture-provider', allowlist: ['127.0.0.1', 'localhost'], timeoutMs: 250
      }));
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

    it('enforces pending approval and exact-scope confirmation', () => {
      const pending = jobManager.registerJob({
        id: 'pending-job', capabilityId: 'typed_agent_teams', category: 'agent_teams',
        title: 'Dangerous task', requester: 'Operator', requiresExactScopeConfirmation: true,
        confirmationScope: 'EXACT_SCOPE'
      });
      expect(pending.status).toBe('pending_approval');
      expect(pending.progressPercent).toBeUndefined();
      expect(jobManager.confirmExactScope('missing', 'EXACT_SCOPE')).toBe(false);
      expect(jobManager.confirmExactScope(pending.id, 'WRONG')).toBe(false);
      expect(jobManager.confirmExactScope(pending.id, 'EXACT_SCOPE')).toBe(true);
      expect(jobManager.confirmExactScope(pending.id, 'EXACT_SCOPE')).toBe(false);
      expect(jobManager.getJob(pending.id)).toMatchObject({ status: 'running', progressPercent: 0 });
    });

    it('covers filtering, clamped progress, supplied evidence metadata, and terminal guards', () => {
      const running = jobManager.registerJob({
        id: 'running-job', capabilityId: 'browser_jobs', category: 'browser',
        title: 'Browser run', requester: 'Operator'
      });
      const other = jobManager.registerJob({
        id: 'other-job', capabilityId: 'video_localization', category: 'video_localization',
        title: 'Media run', requester: 'Operator'
      });

      expect(jobManager.listJobs({ category: 'browser', status: 'running' })).toEqual([running]);
      expect(jobManager.updateProgress('missing', 10)).toBe(false);
      expect(jobManager.updateProgress(running.id, -20)).toBe(true);
      expect(jobManager.getJob(running.id)?.progressPercent).toBe(0);
      expect(jobManager.updateProgress(running.id, 120)).toBe(true);
      expect(jobManager.getJob(running.id)?.progressPercent).toBe(100);
      expect(jobManager.addEvidence('missing', { type: 'none', description: 'none' })).toBe(false);
      expect(jobManager.addEvidence(running.id, {
        type: 'fixture', description: 'supplied metadata', digest: 'fixed-digest', timestamp: '2026-08-25T00:00:00.000Z'
      })).toBe(true);
      expect(jobManager.getJob(running.id)?.evidence[0]).toMatchObject({
        digest: 'fixed-digest', timestamp: '2026-08-25T00:00:00.000Z'
      });

      expect(jobManager.completeJob('missing')).toBe(false);
      expect(jobManager.completeJob(running.id, 'fallback used')).toBe(true);
      expect(jobManager.getJob(running.id)?.fallbackReason).toBe('fallback used');
      expect(jobManager.completeJob(running.id)).toBe(false);
      expect(jobManager.updateProgress(running.id, 50)).toBe(false);
      expect(jobManager.cancelJob(running.id)).toBe(false);

      expect(jobManager.failJob('missing', 'failure')).toBe(false);
      expect(jobManager.failJob(other.id, 'fixture failure')).toBe(true);
      expect(jobManager.cancelJob(other.id)).toBe(false);
    });

    it('does not fail or complete a cancelled job and supplies a default cancellation reason', () => {
      const job = jobManager.registerJob({
        capabilityId: 'browser_jobs', category: 'browser', title: 'Cancel guards', requester: 'Operator'
      });
      expect(jobManager.cancelJob('missing')).toBe(false);
      expect(jobManager.cancelJob(job.id)).toBe(true);
      expect(jobManager.getJob(job.id)?.fallbackReason).toBe('Cancelled by operator');
      expect(jobManager.failJob(job.id, 'late failure')).toBe(false);
      expect(jobManager.completeJob(job.id)).toBe(false);
    });
  });
});
