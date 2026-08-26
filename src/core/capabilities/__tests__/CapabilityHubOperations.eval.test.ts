import { SupportBundleService } from '../diagnostics/SupportBundleService';
import { CapabilityGuidedDoctor } from '../health/CapabilityGuidedDoctor';
import { UnifiedJobConsoleService } from '../jobs/UnifiedJobConsoleService';
import { ArtifactLineageService } from '../artifacts/ArtifactLineageService';
import { PackManagerService } from '../packs/PackManagerService';

describe('PHASE PX-18: Unified Capability Hub, Setup, Jobs, Artifacts & Operations UX', () => {
  describe('PX18-T09: Support Bundle & Redacted Diagnostics', () => {
    it('generates a sanitized support bundle and redacts secrets, tokens, and PII', () => {
      const rawConfig = {
        normalField: 'Chatbot Engine',
        apiKey: 'sk-1234567890abcdef1234567890',
        userEmail: 'alice@example.com',
        userPath: 'C:\\Users\\dferr\\secret_project'
      };

      const bundle = SupportBundleService.generateBundle('LOCAL_TRUSTED', undefined, rawConfig);

      expect(bundle.bundleId).toMatch(/^bundle-/);
      expect(bundle.sha256Digest).toHaveLength(64);
      expect(bundle.diagnostics.deploymentProfile).toBe('LOCAL_TRUSTED');

      // Verify redactions
      const configStr = JSON.stringify(bundle.diagnostics.sanitizedConfig);
      expect(configStr).not.toContain('sk-1234567890abcdef1234567890');
      expect(configStr).not.toContain('alice@example.com');
      expect(configStr).toContain('[REDACTED_SECRET]');
      expect(configStr).toContain('[REDACTED_PII]');
    });
  });

  describe('PX18-T03: Guided Setup Doctor & Dependency Validation', () => {
    it('generates a step-by-step setup plan and checks deployment profile invariants', () => {
      const localPlan = CapabilityGuidedDoctor.generatePlan(
        'godot_bridge',
        'Godot Engine Bridge',
        'LOCAL_TRUSTED',
        true
      );
      expect(localPlan.deploymentProfileAllowed).toBe(true);
      expect(localPlan.prerequisites.length).toBeGreaterThan(0);
      expect(localPlan.steps.length).toBe(3);

      const hostedPlan = CapabilityGuidedDoctor.generatePlan(
        'godot_bridge',
        'Godot Engine Bridge',
        'HOSTED',
        true
      );
      expect(hostedPlan.deploymentProfileAllowed).toBe(false);
    });

    it('executes setup and health check probe with secret masking in recorded configuration', async () => {
      const plan = CapabilityGuidedDoctor.generatePlan('mock_api', 'Mock API Engine', 'LOCAL_TRUSTED', false);

      const result = await CapabilityGuidedDoctor.executeSetup(
        plan,
        { endpointUrl: 'http://localhost:8080', apiKey: 'secret-token-123' },
        async (cfg) => ({ ok: cfg.endpointUrl.length > 0, message: 'Probe OK' })
      );

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('healthy');
      expect(result.appliedConfiguration.apiKey).toBe('********');
      expect(result.auditDigest).toHaveLength(64);
    });
  });

  describe('PX18-T04 & PX18-T05: Unified Job Console & Exact-Scope Approvals', () => {
    it('creates, transitions, approves, logs, and cancels capability jobs', () => {
      const jobService = new UnifiedJobConsoleService();

      const job = jobService.createJob({
        capabilityId: 'stem_deck',
        packId: 'pack-audio-lab',
        ownerId: 'user-1',
        projectId: 'project-alpha',
        title: '6-Stem Separation on audio.wav',
        inputPayload: { filePath: 'audio.wav', model: 'htdemucs_ft' }
      });

      expect(job.state).toBe('queued');
      expect(job.inputDigest).toHaveLength(64);

      // Transition to running
      jobService.transitionState(job.id, 'running', 'Processing Stems', 45, 'Demucs worker started');
      let current = jobService.getJob(job.id);
      expect(current?.state).toBe('running');
      expect(current?.progressPercent).toBe(45);

      // Record exact-scope approval
      jobService.recordApproval(job.id, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      current = jobService.getJob(job.id);
      expect(current?.approvalDigest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      // Cancel job
      jobService.cancelJob(job.id, 'User stopped playback');
      current = jobService.getJob(job.id);
      expect(current?.state).toBe('cancelled');
      expect(current?.finishedAt).toBeDefined();
    });
  });

  describe('PX18-T06: Artifact Browser & Lineage Tracking', () => {
    it('registers artifacts, computes SHA-256 integrity, and navigates parent lineage', () => {
      const lineageService = new ArtifactLineageService();

      const rootArt = lineageService.registerArtifact({
        projectId: 'proj-1',
        ownerId: 'owner-1',
        capabilityId: 'speech_recognition',
        packId: 'pack-voice',
        name: 'transcript.txt',
        mimeType: 'text/plain',
        contentBufferOrString: 'Hello world transcript'
      });

      const derivedArt = lineageService.registerArtifact({
        projectId: 'proj-1',
        ownerId: 'owner-1',
        capabilityId: 'study_studio',
        packId: 'pack-study',
        name: 'flashcards.json',
        mimeType: 'application/json',
        contentBufferOrString: JSON.stringify([{ q: 'What was said?', a: 'Hello world' }]),
        parentArtifactIds: [rootArt.id]
      });

      expect(rootArt.sha256Hash).toHaveLength(64);
      expect(derivedArt.sha256Hash).toHaveLength(64);

      const tree = lineageService.getLineageTree(derivedArt.id);
      expect(tree.current.id).toBe(derivedArt.id);
      expect(tree.parents.length).toBe(1);
      expect(tree.parents[0].id).toBe(rootArt.id);
    });
  });

  describe('PX18-T08: Pack Manager, Comparison, and Rollback', () => {
    it('installs default-disabled pack, compares permission diffs, and rolls back cleanly', () => {
      const packService = new PackManagerService();

      const installed = packService.installPack({
        packId: 'pack-godot-bridge',
        displayName: 'Godot Engine Bridge Pack',
        version: '1.0.0',
        description: 'Enables Godot 4 editor control',
        source: {
          license: 'MIT',
          integration: 'native',
          notices: ['Godot Engine MIT']
        },
        maturity: 'experimental',
        profiles: ['LOCAL_TRUSTED'],
        permissions: ['engine.read', 'process.execute.allowlisted'],
        capabilities: ['godot_bridge']
      });

      expect(installed.status).toBe('disabled');
      expect(installed.version).toBe('1.0.0');

      // Compare versions
      const comparison = packService.compareVersions('pack-godot-bridge', {
        version: '1.1.0',
        permissions: ['engine.read', 'process.execute.allowlisted', 'filesystem.write.approved_root'],
        capabilities: ['godot_bridge', 'godot_scene_exporter']
      });

      expect(comparison.breakingChangesDetected).toBe(true);
      expect(comparison.permissionDiff.added).toContain('filesystem.write.approved_root');

      // Update pack
      const updated = packService.updatePack('pack-godot-bridge', {
        version: '1.1.0',
        permissions: ['engine.read', 'process.execute.allowlisted', 'filesystem.write.approved_root'],
        capabilities: ['godot_bridge', 'godot_scene_exporter']
      });

      expect(updated.version).toBe('1.1.0');
      expect(updated.previousVersion).toBe('1.0.0');

      // Rollback
      const rolledBack = packService.rollbackPack('pack-godot-bridge');
      expect(rolledBack.version).toBe('1.0.0');
    });
  });
});
