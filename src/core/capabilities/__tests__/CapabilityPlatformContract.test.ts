import { CapabilitySDK } from '../sdk/CapabilitySDK';
import validManifest from '../packs/__fixtures__/valid-manifest.json';
import { CapabilitySqliteStore } from '../persistence/CapabilitySqliteStore';

describe('CapabilityPlatformContract (PX-02)', () => {
  let sdk: CapabilitySDK;

  beforeEach(() => {
    sdk = CapabilitySDK.getInstance();
    sdk.installer.clear();
    sdk.jobs.clear();
    sdk.approvals.clear();
    sdk.artifacts.clear();
    sdk.permissions.clearOverrides();
    sdk.health.clear();
    sdk.config.clear();
  });

  it('PX02-T01..T03: installs and enables a valid capability pack with lifecycle hooks', async () => {
    // 1. Dry run plan
    const planResult = sdk.planInstallation(validManifest);
    expect(planResult.success).toBe(true);
    expect(planResult.plan?.packId).toBe('pack-context-economy');

    // 2. Install disabled
    const installResult = sdk.registerPack(validManifest, 'admin-user');
    expect(installResult.success).toBe(true);
    expect(installResult.record?.enabled).toBe(false);
    expect(installResult.record?.status).toBe('installed_disabled');

    // 3. Register a healthy check
    sdk.registerHealthCheck('context-economy', 'store-integrity-check', async () => {
      return { passed: true, message: 'Store OK' };
    });

    // 4. Enable pack
    const enableResult = await sdk.enablePack('pack-context-economy', 'admin-user');
    expect(enableResult.success).toBe(true);

    const installed = sdk.installer.getInstalledPack('pack-context-economy');
    expect(installed?.enabled).toBe(true);
    expect(installed?.status).toBe('enabled');

    // 5. Appears in server registry
    const caps = sdk.registry.getCapabilities('local', 'developer');
    expect(caps.find(c => c.id === 'context-economy')).toMatchObject({
      healthState: 'healthy',
      section: 'available_now'
    });
  });

  it('keeps disabled, role-restricted, and profile-restricted pack capabilities non-executable', async () => {
    const restrictedManifest = {
      ...validManifest,
      id: 'pack-restricted',
      profiles: ['LOCAL_TRUSTED'],
      capabilities: [{
        ...validManifest.capabilities[0],
        id: 'restricted-capability',
        maturity: 'disabled',
        processingLocation: 'local',
        localOnly: true,
        requiredRole: 'admin'
      }]
    };
    expect(sdk.registerPack(restrictedManifest, 'admin-user').success).toBe(true);
    sdk.registerHealthCheck('restricted-capability', 'health', async () => ({ passed: true }));
    expect((await sdk.enablePack('pack-restricted', 'admin-user')).success).toBe(true);

    expect(sdk.registry.getCapabilities('local', 'developer').find(c => c.id === 'restricted-capability'))
      .toMatchObject({ section: 'disabled_by_policy', healthState: 'disabled', actions: [] });
    expect(sdk.registry.getCapabilities('hosted', 'admin').find(c => c.id === 'restricted-capability'))
      .toMatchObject({ section: 'disabled_by_policy', healthState: 'disabled', actions: [] });
  });

  it('PX02-T04: enforces default-deny permissions and hosted restrictions', () => {
    // Permission evaluation
    const hostedResult = sdk.checkPermission({
      userId: 'user-1',
      userRole: 'developer',
      profile: 'hosted',
      capabilityId: 'code-tools',
      capabilityMaturity: 'PRODUCTION_SUPPORTED',
      requestedPermission: 'process.execute.allowlisted'
    });

    // Dangerous process execution should be blocked in HOSTED mode
    expect(hostedResult.granted).toBe(false);
    expect(hostedResult.reason).toContain('prohibited in HOSTED');

    // Local trusted with approval required
    const localResultNoApproval = sdk.checkPermission({
      userId: 'user-1',
      userRole: 'developer',
      profile: 'local',
      capabilityId: 'code-tools',
      capabilityMaturity: 'PRODUCTION_SUPPORTED',
      requestedPermission: 'browser.mutate.approved'
    });

    expect(localResultNoApproval.granted).toBe(false);
    expect(localResultNoApproval.reason).toContain('approval digest');
  });

  it('PX02-T05 & T06: orchestrates staged jobs with approval digests', async () => {
    // 1. Create approval
    const approval = sdk.approveScope({
      jobType: 'compression-job',
      capabilityId: 'context-economy',
      ownerId: 'dev-1',
      projectId: 'proj-1',
      inputHashes: ['hash-123'],
      targetPaths: ['/src/index.ts'],
      proposedActions: ['compress_file'],
      resourceBudget: { deadlineMs: 5000 },
      dataEgress: {
        destinationType: 'local_only',
        targetEndpoints: [],
        transfersSensitiveData: false
      }
    }, 'approver-admin');

    expect(approval.approvalDigest).toBeDefined();

    // 2. Register execution stages
    sdk.registerJobStages('context-economy', [
      {
        name: 'compress_stage',
        isIdempotent: true,
        execute: async (job, update) => {
          update(50);
          const artifact = sdk.storeArtifact({
            jobId: job.id,
            capabilityId: job.capabilityId,
            packVersion: '1.0.0',
            ownerId: job.ownerId,
            filename: 'compressed.json',
            contentType: 'application/json',
            content: '{"compressed": true}'
          });
          return { artifacts: [artifact.id], result: 'Done' };
        }
      }
    ]);

    // 3. Create and run job
    const job = sdk.createJob({
      capabilityId: 'context-economy',
      packId: 'pack-context-economy',
      ownerId: 'dev-1',
      projectId: 'proj-1',
      inputs: { target: '/src/index.ts' },
      approvalDigest: approval.approvalDigest
    });

    expect(job.state).toBe('queued');

    const finished = await sdk.runJob(job.id);
    expect(finished.state).toBe('succeeded');
    expect(finished.progressPercent).toBe(100);
    expect(finished.artifacts.length).toBe(1);
  });

  it('PX02-T07: stores artifacts with content-addressed SHA-256 integrity', () => {
    const art = sdk.storeArtifact({
      jobId: 'job-1',
      capabilityId: 'context-economy',
      packVersion: '1.0.0',
      ownerId: 'user-1',
      filename: 'sample.txt',
      contentType: 'text/plain',
      content: 'Sample test content'
    });

    expect(art.sha256Digest).toBeDefined();
    expect(art.byteSize).toBe(Buffer.from('Sample test content').length);

    // Access check: owner can access
    const fetched = sdk.artifacts.getArtifactMetadata(art.id, { userId: 'user-1' });
    expect(fetched).toBeDefined();

    // Another user is denied
    const denied = sdk.artifacts.getArtifactMetadata(art.id, { userId: 'user-2' });
    expect(denied).toBeUndefined();
  });

  it('PX02-T08: rejects jobs exceeding resource budgets', async () => {
    sdk.registerJobStages('heavy-cap', [
      {
        name: 'heavy_stage',
        isIdempotent: true,
        execute: async (job) => {
          // Simulate memory overflow
          sdk.resources.recordUsage(job.id, { ramUsedBytes: 10 * 1024 * 1024 * 1024 }); // 10GB > 4GB limit
          return {};
        }
      }
    ]);

    const job = sdk.createJob({
      capabilityId: 'heavy-cap',
      packId: 'pack-heavy',
      ownerId: 'user-1',
      inputs: {},
      budget: { ramCeilingBytes: 2 * 1024 * 1024 * 1024 } // 2GB
    });

    const finished = await sdk.runJob(job.id);
    expect(finished.state).toBe('failed');
    expect(finished.failureCategory).toBe('budget_exceeded');
  });

  it('PX02-T11: runs SQLite persistence migrations and operations', () => {
    const store = new CapabilitySqliteStore(':memory:');

    store.saveJob({
      id: 'job-sql-1',
      capabilityId: 'context-economy',
      packId: 'pack-1',
      ownerId: 'user-1',
      state: 'succeeded',
      currentStage: 'done',
      progressPercent: 100,
      inputDigest: 'abc123digest',
      resourceBudgetJson: '{}',
      createdAt: new Date().toISOString()
    });

    const fetched = store.getJob('job-sql-1');
    expect(fetched).toBeDefined();
    expect(fetched.id).toBe('job-sql-1');
    expect(fetched.capability_id).toBe('context-economy');

    store.close();
  });
});
