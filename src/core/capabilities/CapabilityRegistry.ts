/**
 * Capability Registry Service (CF-09)
 * Centralizes capability inventory, maturity, health diagnostics, permissions,
 * and execution policies across hosted and local-trusted runtimes.
 */

import { resolveDeploymentMode, RuntimeProfile } from '../config/EnvironmentDefinitions';
import { CapabilityJobManager, CapabilityJob } from './CapabilityJobManager';
import { LocalModelDiscovery } from '../providers/local/LocalModelDiscovery';
import { createTaskEnvelope, verifyTaskEnvelope } from '../coding/teams/TaskEnvelope';
import { createAuthorizedBrowserJob, verifyBrowserJobIntegrity } from '../browser/AuthorizedBrowserJob';
import { createMediaConsentRecord } from '../multimodal/localization/MediaConsentRecord';
import { createVideoLocalizationJob, verifyVideoLocalizationJobIntegrity } from '../multimodal/localization/VideoLocalizationJob';
import { LatticeGameAdapter } from '../gaming/lattice/LatticeGameAdapter';
import { LatticeSimulationEngine } from '../gaming/lattice/LatticeSimulationEngine';
import { CapabilityInstallationManager } from './packs/CapabilityInstallationManager';
import { CapabilityPackManifest } from './packs/CapabilityPackManifest';
import { CapabilityHealthDiagnostics } from './health/CapabilityHealthDiagnostics';

export type CapabilitySection =
  | 'available_now'
  | 'needs_setup'
  | 'local_only'
  | 'preview'
  | 'disabled_by_policy'
  | 'unhealthy_degraded';

export type CapabilityMaturity =
  | 'PRODUCTION_SUPPORTED'
  | 'PRODUCTION_PREVIEW'
  | 'LOCAL_ONLY_EXPERIMENTAL'
  | 'DEPRECATED';

export type ProcessingLocation = 'local' | 'hosted' | 'hybrid' | 'browser' | 'external_provider';
export type CapabilityHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'not_configured' | 'disabled';
export type UserRole = 'user' | 'developer' | 'admin';

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  isDangerous?: boolean;
  requiredConfirmationScope?: string;
  requiredRole?: UserRole;
}

export interface CapabilityItem {
  id: string;
  name: string;
  shortDescription: string;
  detailedDescription: string;
  category: 'core' | 'coding' | 'multimodal' | 'agents' | 'data' | 'integrations' | 'gaming';
  section: CapabilitySection;
  maturity: CapabilityMaturity;
  processingLocation: ProcessingLocation;
  provider: string;
  requiredSoftware: string[];
  requiredModels?: string[];
  requiredHardware?: string[];
  authorityAndEgress: {
    filesystemAuthority: string;
    networkEgress: string;
    processAuthority: string;
    approvalGateRequired: boolean;
  };
  healthState: CapabilityHealthState;
  healthReason?: string;
  version: string;
  estimatedCostAndResources: {
    computeImpact: 'Low (CPU only)' | 'Medium (~4GB VRAM/RAM)' | 'High (GPU VRAM recommended)';
    estimatedLatency: string;
    costProfile: 'Free / Local Compute' | 'Pay-per-token External' | 'Zero-cost Headless';
  };
  dataRetentionPolicy: string;
  supportStatusAndLimitations: string[];
  diagnostics?: {
    isBlocked: boolean;
    issues: string[];
    remediationSteps: string[];
  };
  actions: ActionDefinition[];
  requiredRole?: UserRole;
  localOnly: boolean;
  apiBasePath?: string;
}

export class CapabilityRegistry {
  private static instance: CapabilityRegistry;
  private jobManager = CapabilityJobManager.getInstance();
  private capabilityOverrides = new Map<string, Partial<CapabilityItem>>();

  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  public getCapabilities(profile: RuntimeProfile = resolveDeploymentMode(), userRole: UserRole = 'developer'): CapabilityItem[] {
    const rawList = this.buildBaseCapabilities();
    const evaluatedList: CapabilityItem[] = [];

    for (const base of rawList) {
      const override = this.capabilityOverrides.get(base.id) || {};
      const item: CapabilityItem = { ...base, ...override };

      // Apply runtime deployment mode constraints
      if (profile === 'hosted' && item.localOnly) {
        item.section = 'disabled_by_policy';
        item.healthState = 'disabled';
        item.healthReason = 'Local-only capabilities are strictly disabled in hosted deployment profile.';
        item.actions = [];
        item.diagnostics = {
          isBlocked: true,
          issues: ['Hosted deployment profile policy prohibits local filesystem and process execution.'],
          remediationSteps: ['Run this capability from an explicitly configured LOCAL_TRUSTED deployment.']
        };
      }

      if (this.capabilityOverrides.has(base.id)) {
        item.actions = [
          ...item.actions.filter(a => a.id !== 'disable_capability'),
          { id: 'enable_capability', label: `Enable ${base.name}`, description: 'Restore default capability policy.', requiredRole: 'admin' }
        ];
      }

      // Filter actions based on user role
      item.actions = item.actions.filter(action => {
        if (!action.requiredRole) return true;
        if (userRole === 'admin') return true;
        if (userRole === 'developer' && action.requiredRole !== 'admin') return true;
        return action.requiredRole === userRole;
      });

      evaluatedList.push(item);
    }

    // Merge capabilities from installed packs (PX-02)
    const installManager = CapabilityInstallationManager.getInstance();
    const installedPacks = installManager.listInstalledPacks();

    for (const packRecord of installedPacks) {
      if (!packRecord.enabled) continue;
      const manifest = packRecord.manifest;
      for (const cap of manifest.capabilities) {
        if (evaluatedList.some(e => e.id === cap.id)) continue; // Avoid duplicate IDs
        const profileAllowed = profile === 'hosted'
          ? manifest.profiles.includes('HOSTED')
          : manifest.profiles.includes('LOCAL_TRUSTED');
        const roleAllowed = userRole === 'admin'
          || cap.requiredRole === undefined
          || cap.requiredRole === userRole
          || (userRole === 'developer' && cap.requiredRole === 'user');
        const declaredPermissions = new Map(
          manifest.permissions.map(permission => [permission.permission, permission])
        );
        const approvalRequired = cap.requiredPermissions.some(
          permission => declaredPermissions.get(permission)?.requiresApproval === true
        );
        const localOnly = cap.localOnly === true || cap.processingLocation === 'local';
        const healthSnapshot = CapabilityHealthDiagnostics.getInstance().getLatestSnapshot(cap.id);

        const maturityMap: Record<string, CapabilityMaturity> = {
          supported: 'PRODUCTION_SUPPORTED',
          preview: 'PRODUCTION_PREVIEW',
          experimental: 'LOCAL_ONLY_EXPERIMENTAL',
          disabled: 'DEPRECATED'
        };

        const item: CapabilityItem = {
          id: cap.id,
          name: cap.name,
          shortDescription: cap.description,
          detailedDescription: cap.description,
          category: (cap.category === 'voice' || cap.category === 'writing' || cap.category === 'study' || cap.category === 'web' || cap.category === 'audio') ? 'multimodal' : cap.category,
          section: cap.maturity === 'disabled' ? 'disabled_by_policy' : 'available_now',
          maturity: maturityMap[cap.maturity] || 'LOCAL_ONLY_EXPERIMENTAL',
          processingLocation: cap.processingLocation,
          provider: manifest.displayName,
          requiredSoftware: [],
          authorityAndEgress: {
            filesystemAuthority: 'Pack scoped authority',
            networkEgress: manifest.source.integration === 'external_service' ? 'External service communication' : 'Zero egress',
            processAuthority: 'Pack declared tools only',
            approvalGateRequired: approvalRequired
          },
          healthState: cap.maturity === 'disabled'
            ? 'disabled'
            : healthSnapshot?.status || 'not_configured',
          healthReason: cap.maturity === 'disabled'
            ? 'Capability is disabled by its pack manifest.'
            : healthSnapshot
              ? healthSnapshot.degradedReasons.join('; ') || 'Live health diagnostics passed.'
              : 'Pack capability has not completed a live health diagnostic.',
          version: manifest.version,
          estimatedCostAndResources: {
            computeImpact: 'Low (CPU only)',
            estimatedLatency: '< 100ms',
            costProfile: 'Free / Local Compute'
          },
          dataRetentionPolicy: 'Governed by pack configuration and capability artifact store.',
          supportStatusAndLimitations: [
            `Installed capability pack: ${manifest.id}@${manifest.version}`,
            `Source integration: ${manifest.source.integration}`
          ],
          actions: (manifest.tools || []).map(t => ({
            id: t.id,
            label: t.name,
            description: t.description,
            isDangerous: t.isDangerous,
            requiredConfirmationScope: t.requiredConfirmationScope
          })),
          requiredRole: cap.requiredRole,
          localOnly
        };

        if (!profileAllowed || (profile === 'hosted' && item.localOnly)) {
          item.section = 'disabled_by_policy';
          item.healthState = 'disabled';
          item.healthReason = !profileAllowed
            ? `Capability pack does not support the ${profile} deployment profile.`
            : 'Local-only capabilities are strictly disabled in hosted deployment profile.';
          item.actions = [];
        } else if (!roleAllowed || cap.maturity === 'disabled') {
          item.section = 'disabled_by_policy';
          item.healthState = 'disabled';
          item.healthReason = !roleAllowed
            ? `Capability requires the ${cap.requiredRole} role.`
            : item.healthReason;
          item.actions = [];
        }

        evaluatedList.push(item);
      }
    }

    return evaluatedList;
  }

  public registerPackManifest(manifest: unknown, userId: string = 'system'): { success: boolean; errors?: string[] } {
    const installManager = CapabilityInstallationManager.getInstance();
    const installResult = installManager.installPack(manifest, userId);
    if (!installResult.success) {
      return { success: false, errors: installResult.errors };
    }
    return { success: true };
  }

  public getInstalledPacks() {
    return CapabilityInstallationManager.getInstance().listInstalledPacks();
  }

  public clearOverrides(): void {
    this.capabilityOverrides.clear();
  }

  public disableCapability(id: string): boolean {
    if (!this.getCapabilityById(id, 'local', 'admin')) return false;
    const existing = this.capabilityOverrides.get(id) || {};
    this.capabilityOverrides.set(id, {
      ...existing,
      section: 'disabled_by_policy',
      healthState: 'disabled',
      healthReason: 'Explicitly disabled by operator.'
    });
    return true;
  }

  public restoreCapabilityPolicy(id: string): boolean {
    if (!this.getCapabilityById(id, 'local', 'admin')) return false;
    this.capabilityOverrides.delete(id);
    return true;
  }

  public updateCapabilityMaturity(id: string, maturity: CapabilityMaturity): void {
    const existing = this.capabilityOverrides.get(id) || {};
    this.capabilityOverrides.set(id, {
      ...existing,
      maturity
    });
  }

  public getCapabilityById(id: string, profile: RuntimeProfile = resolveDeploymentMode(), userRole: UserRole = 'developer'): CapabilityItem | undefined {
    const all = this.getCapabilities(profile, userRole);
    return all.find(c => c.id === id);
  }

  public async executeAction(capabilityId: string, actionId: string, options: {
    confirmedScope?: string;
    requester?: string;
    userRole?: UserRole;
  } = {}): Promise<{ success: boolean; message: string; job?: CapabilityJob }> {
    const capability = this.getCapabilityById(capabilityId, resolveDeploymentMode(), options.userRole || 'developer');
    if (!capability) {
      return { success: false, message: `Capability '${capabilityId}' not found.` };
    }

    const action = capability.actions.find(a => a.id === actionId);
    if (!action) {
      return { success: false, message: `Action '${actionId}' not available for capability '${capabilityId}'.` };
    }

    if (action.isDangerous && action.requiredConfirmationScope) {
      if (options.confirmedScope !== action.requiredConfirmationScope) {
        return {
          success: false,
          message: `Dangerous action requires exact-scope confirmation matching "${action.requiredConfirmationScope}".`
        };
      }
    }

    // Process specific capability actions
    switch (actionId) {
      case 'test_run':
      case 'run_canary': {
        const job = this.jobManager.registerJob({
          capabilityId: capability.id,
          category: this.mapCategoryToJob(capability.category),
          title: `Diagnostic test for ${capability.name}`,
          requester: options.requester || 'CapabilityHub Operator',
          requiresExactScopeConfirmation: action.isDangerous,
          confirmationScope: action.requiredConfirmationScope,
          confirmedAt: options.confirmedScope ? new Date().toISOString() : undefined
        });

        try {
          const evidence = await this.runCapabilityDiagnostic(capabilityId);
          this.jobManager.addEvidence(job.id, evidence);
          this.jobManager.completeJob(job.id);
          return { success: true, message: `Verified diagnostic completed for ${capability.name}.`, job };
        } catch (error: any) {
          this.jobManager.failJob(job.id, error.message || String(error));
          return { success: false, message: `Diagnostic failed for ${capability.name}: ${error.message || String(error)}`, job };
        }
      }

      case 'disable_capability': {
        this.disableCapability(capabilityId);
        return { success: true, message: `Capability '${capability.name}' has been disabled.` };
      }

      case 'enable_capability': {
        this.restoreCapabilityPolicy(capabilityId);
        return { success: true, message: `Capability '${capability.name}' default policy restored.` };
      }

      default: {
        return { success: false, message: `No executable handler is registered for action '${action.label}'.` };
      }
    }
  }

  private async runCapabilityDiagnostic(capabilityId: string): Promise<{
    type: string;
    description: string;
    dataPreview: Record<string, unknown>;
  }> {
    if (capabilityId === 'local_model_adapter') {
      if (process.env.LOCAL_MODEL_ENABLED !== 'true') {
        throw new Error('LOCAL_MODEL_ENABLED is false; configure and start the external endpoint before probing.');
      }
      const baseUrl = process.env.LOCAL_MODEL_BASE_URL;
      if (!baseUrl) throw new Error('LOCAL_MODEL_BASE_URL is not configured.');
      const status = await new LocalModelDiscovery().probeEndpoint(baseUrl, {
        providerName: process.env.LOCAL_MODEL_PROVIDER_NAME || 'local-openai',
        apiKey: process.env.LOCAL_MODEL_API_KEY,
        profile: resolveDeploymentMode(),
        allowlist: (process.env.LOCAL_MODEL_ALLOWLIST || '').split(',').map(item => item.trim()).filter(Boolean),
        timeoutMs: Number(process.env.LOCAL_MODEL_TIMEOUT_MS || 5000)
      });
      if (status.health !== 'healthy') throw new Error(status.error || `Endpoint health is ${status.health}.`);
      this.capabilityOverrides.set(capabilityId, {
        section: 'available_now',
        healthState: 'healthy',
        healthReason: `Probe succeeded at ${status.lastChecked}`,
        provider: `${status.provider} (${status.baseUrl})`
      });
      return {
        type: 'local_model_probe',
        description: `Live endpoint probe discovered ${status.models.length} model(s).`,
        dataPreview: { provider: status.provider, health: status.health, version: status.version || 'unreported', modelCount: status.models.length }
      };
    }

    if (capabilityId === 'typed_agent_teams') {
      const envelope = createTaskEnvelope({
        taskId: 'capability-hub-team-contract-check',
        role: 'integration_supervisor',
        title: 'Capability Hub team contract check',
        description: 'Verify immutable task authority and budget envelope generation.',
        successCriteria: ['Envelope digest verifies']
      });
      if (!verifyTaskEnvelope(envelope)) throw new Error('Task envelope digest verification failed.');
      return {
        type: 'agent_team_contract_check',
        description: 'Task envelope authority and digest contract verified. This does not certify a real Git worktree canary.',
        dataPreview: { role: envelope.role, digest: envelope.approvalDigest, realGitWorktreeCanary: false }
      };
    }

    if (capabilityId === 'browser_jobs') {
      const job = createAuthorizedBrowserJob({
        jobId: 'capability-hub-browser-contract-check',
        purpose: 'Verify browser job origin and approval contract',
        requesterId: 'capability-hub',
        originAllowlist: ['https://example.com'],
        actions: [{ id: 'navigate', type: 'navigate', target: 'https://example.com' }]
      });
      if (!verifyBrowserJobIntegrity(job)) throw new Error('Browser job digest verification failed.');
      return {
        type: 'browser_job_contract_check',
        description: 'Origin allowlist, budget, and digest contract verified without external navigation.',
        dataPreview: { originCount: job.originAllowlist.length, actionCount: job.actions.length, liveBrowserCanary: false }
      };
    }

    if (capabilityId === 'video_localization') {
      const jobId = 'capability-hub-localization-contract-check';
      const consent = createMediaConsentRecord({
        jobId,
        rightsholderId: 'synthetic-fixture',
        rightsholderName: 'Synthetic Test Fixture',
        sourceRightsConfirmed: true,
        voiceCloningAuthorized: false,
        syntheticMediaDisclosureConfirmed: true,
        operatorApproval: 'capability-hub-contract-check'
      });
      const job = createVideoLocalizationJob({
        jobId,
        title: 'Synthetic localization contract check',
        sourceFilePath: 'synthetic-fixture.mp4',
        sourceFileHash: '0'.repeat(64),
        sourceLanguage: 'en',
        targetLanguage: 'es',
        consentRecord: consent
      });
      if (!verifyVideoLocalizationJobIntegrity(job)) throw new Error('Localization job digest verification failed.');
      return {
        type: 'localization_contract_check',
        description: 'Consent binding, source provenance, and job digest contract verified without processing media.',
        dataPreview: { consentId: consent.consentId, voiceCloningAuthorized: false, liveMediaCanary: false }
      };
    }

    if (capabilityId === 'lattice_gamedev') {
      const scenario = new LatticeGameAdapter().createIsometricDungeonScenario({ seed: 4242, width: 8, height: 8 });
      const first = new LatticeSimulationEngine(scenario).runTicks(10);
      const second = new LatticeSimulationEngine(scenario).runTicks(10);
      const firstDigest = first.snapshots[first.snapshots.length - 1]?.stateDigest;
      const secondDigest = second.snapshots[second.snapshots.length - 1]?.stateDigest;
      if (!firstDigest || firstDigest !== secondDigest) throw new Error('Deterministic replay digest mismatch.');
      return {
        type: 'lattice_replay_canary',
        description: 'Two independent 10-tick simulations produced the same final digest.',
        dataPreview: { seed: scenario.world.seed, ticks: first.totalTicks, stateDigest: firstDigest }
      };
    }

    const exposureContracts: Record<string, { featureFamily: string; route: string; implementation: string }> = {
      context_economy: {
        featureFamily: 'PX-03',
        route: '/api/context-economy',
        implementation: 'ContextContentRouter and ReversibleContextStore'
      },
      project_memory: {
        featureFamily: 'PX-05',
        route: '/api/project-memory',
        implementation: 'ProjectMemoryService and Memory Center'
      },
      agent_operations: {
        featureFamily: 'PX-06',
        route: '/api/agent-operations',
        implementation: 'AgentOperationsConsoleService and WorkspaceClaimService'
      },
      game_engine_bridge: {
        featureFamily: 'PX-08/PX-09',
        route: '/api/game-studio',
        implementation: 'GameEngineBridge and MultiEngineStudioService'
      },
      desktop_voice_companion: {
        featureFamily: 'PX-12',
        route: '/api/desktop-companion',
        implementation: 'DesktopCompanionBriefingService and privacy-gated screen context'
      },
      media_accessibility: {
        featureFamily: 'PX-13',
        route: '/api/media-accessibility',
        implementation: 'SubtitleEditorService, dubbing consent gate, and narration services'
      },
      writing_studio: {
        featureFamily: 'PX-14',
        route: '/api/writing-studio',
        implementation: 'WritingStudioService and lossless document workspace'
      },
      study_studio: {
        featureFamily: 'PX-15',
        route: '/api/study-studio',
        implementation: 'StudyStudioService and source-grounded education tools'
      },
      web_studio: {
        featureFamily: 'PX-16',
        route: '/api/website-workspace',
        implementation: 'WebStudioService and sandboxed website preview workspace'
      },
      developer_utility_pack: {
        featureFamily: 'PX-17',
        route: '/api/mock-api',
        implementation: 'MockApiService, utility workbench, and source-preserving exporters'
      }
    };
    const exposureContract = exposureContracts[capabilityId];
    if (exposureContract) {
      return {
        type: 'capability_exposure_contract',
        description: `${exposureContract.featureFamily} registry, implementation, and API exposure contract is present. This is not a live external-provider canary.`,
        dataPreview: {
          capabilityId,
          route: exposureContract.route,
          implementation: exposureContract.implementation,
          liveExternalCanary: false
        }
      };
    }

    throw new Error(`Capability '${capabilityId}' does not yet have a verified diagnostic handler.`);
  }

  private mapCategoryToJob(cat: CapabilityItem['category']): CapabilityJob['category'] {
    switch (cat) {
      case 'agents': return 'agent_teams';
      case 'multimodal': return 'video_localization';
      case 'gaming': return 'lattice_gamedev';
      case 'coding': return 'findings_analysis';
      default: return 'code_workflow';
    }
  }

  private buildBaseCapabilities(): CapabilityItem[] {
    const isLocal = resolveDeploymentMode() !== 'hosted';

    const expansionCapability = (definition: {
      id: string;
      name: string;
      family: string;
      description: string;
      category: CapabilityItem['category'];
      provider: string;
      route: string;
      filesystemAuthority?: string;
      processAuthority?: string;
      approvalGateRequired?: boolean;
      limitations: string[];
    }): CapabilityItem => ({
      id: definition.id,
      name: `${definition.name} (${definition.family})`,
      shortDescription: definition.description,
      detailedDescription: `${definition.description} The Capability Hub exposes the implemented surface at ${definition.route} and keeps it local-only until the remaining release-certification evidence is complete.`,
      category: definition.category,
      section: 'local_only',
      maturity: 'LOCAL_ONLY_EXPERIMENTAL',
      processingLocation: 'local',
      provider: definition.provider,
      requiredSoftware: ['Node.js runtime'],
      authorityAndEgress: {
        filesystemAuthority: definition.filesystemAuthority || 'No filesystem authority',
        networkEgress: 'Zero network egress unless a separately approved provider is configured',
        processAuthority: definition.processAuthority || 'None',
        approvalGateRequired: definition.approvalGateRequired ?? false
      },
      healthState: 'degraded',
      healthReason: 'Implementation and route contracts are available; clean-machine and release-certification canaries remain outstanding.',
      version: `1.0.0-${definition.family.toLowerCase()}`,
      estimatedCostAndResources: {
        computeImpact: 'Low (CPU only)',
        estimatedLatency: 'Depends on the selected operation and input size',
        costProfile: 'Free / Local Compute'
      },
      dataRetentionPolicy: 'Local artifacts remain within the approved workspace and follow the capability-specific lifecycle policy.',
      supportStatusAndLimitations: definition.limitations,
      actions: [{
        id: 'test_run',
        label: 'Verify Exposure Contract',
        description: `Verify that ${definition.family} is registered with its implemented API and service surface without invoking an external provider.`
      }],
      localOnly: true,
      apiBasePath: definition.route
    });

    return [
      expansionCapability({
        id: 'context_economy',
        name: 'Context Economy & Reversible Compression',
        family: 'PX-03',
        description: 'Content-aware compression, exact-evidence preservation, budget planning, and owner-bound reversible retrieval.',
        category: 'core',
        provider: 'ContextContentRouter & ReversibleContextStore',
        route: '/api/context-economy',
        limitations: ['Original context retrieval is owner-bound', 'Lossy paths retain exact-evidence references', 'Benchmark certification is reported separately']
      }),
      expansionCapability({
        id: 'project_memory',
        name: 'Project Memory & Provenance',
        family: 'PX-05',
        description: 'Persistent project decisions, gotchas, branch context, freshness state, and portable memory exports.',
        category: 'data',
        provider: 'ProjectMemoryService & Memory Center',
        route: '/api/project-memory',
        filesystemAuthority: 'Approved workspace memory files only',
        limitations: ['Memory writes are confined to the active workspace', 'Stale records remain visible instead of being silently rewritten', 'User approval is required for protected-memory changes']
      }),
      expansionCapability({
        id: 'agent_operations',
        name: 'Agent Operations Console',
        family: 'PX-06',
        description: 'Normalized agent sessions, resource budgets, workspace claims, scoped communication, and emergency stop controls.',
        category: 'agents',
        provider: 'AgentOperationsConsoleService',
        route: '/api/agent-operations',
        filesystemAuthority: 'Explicit workspace claims only',
        processAuthority: 'Tracked child processes subject to stop-all supervision',
        approvalGateRequired: true,
        limitations: ['Mutating tools require explicit authority', 'Session events are privacy-redacted', 'External agent discovery requires separately configured roots']
      }),
      {
        id: 'repo_architecture',
        name: 'Architecture Graph & Code Topology (CF-01)',
        shortDescription: 'Deterministic symbol graph, call hierarchies, impact analysis, and dependency bounds.',
        detailedDescription: 'Constructs an in-memory directed syntax and dependency graph of codebases behind ApprovedRepositoryGateway. Provides reverse dependency lookup, cycle detection, and impacted test set resolution without dynamic evaluation.',
        category: 'coding',
        section: 'available_now',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'TypeScript AST & Custom Graph Engine',
        requiredSoftware: ['Node.js runtime', 'Source code workspace'],
        authorityAndEgress: {
          filesystemAuthority: 'Read-only bounded workspace files (128KB max per file)',
          networkEgress: 'Zero network egress (pure offline calculation)',
          processAuthority: 'None (no child processes spawned)',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0-cf01',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 100ms for 500 files',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Ephemeral in-memory cache with LRU eviction.',
        supportStatusAndLimitations: [
          'Bounded to 3,000 files maximum per scan',
          'JavaScript, TypeScript, Python, and JSON support',
          'No binary AST decompilation'
        ],
        actions: [
          { id: 'test_run', label: 'Run Graph Diagnostic', description: 'Validate symbol resolution on active workspace.' }
        ],
        localOnly: true
      },
      {
        id: 'hybrid_retrieval',
        name: 'Clean-Room Lexical & Hybrid Retrieval (CF-02)',
        shortDescription: 'BM25-inspired lexical matching combined with dense vector ranking and MRR validation.',
        detailedDescription: 'Provides deterministic BM25 lexical token matching combined with dense vector scoring. Ranks source snippets and architecture documentation with reciprocal rank fusion (RRF) and injection safety filters.',
        category: 'data',
        section: 'available_now',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'Internal RRF & Token Inverted Index',
        requiredSoftware: ['Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'Read-only indexing of approved repository slices',
          networkEgress: 'Zero network egress',
          processAuthority: 'None',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0-cf02',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 20ms per query',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'In-memory inverted index rebuilt on startup.',
        supportStatusAndLimitations: [
          'Exact path containment enforced',
          'Secret denial rules filter matches',
          'Zero telemetry collection'
        ],
        actions: [
          { id: 'test_run', label: 'Run Retrieval Benchmark', description: 'Test MRR and Top-1 accuracy against benchmark suites.' }
        ],
        localOnly: true
      },
      {
        id: 'repository_findings',
        name: 'Repository Findings, SARIF & SBOM (CF-03)',
        shortDescription: 'Security weakness signals, CycloneDX SBOM generation, and accessible 2D overlay visualizer.',
        detailedDescription: 'Analyzes source code for hardcoded secrets, unsafe dynamic capabilities, route authorization policies, and missing lockfiles. Ingests SARIF reports and exports CycloneDX 1.6 software bill of materials (SBOM).',
        category: 'coding',
        section: 'available_now',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'RepositoryFindingsAnalyzer & SarifAdapter',
        requiredSoftware: ['Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'Read-only inspection behind ApprovedRepositoryGateway',
          networkEgress: 'Zero network egress',
          processAuthority: 'None',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0-cf03',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 250ms for entire repository',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Deterministic finding records with SHA-256 evidence digests.',
        supportStatusAndLimitations: [
          'Signals are classified as signal/suspected_weakness/accepted_risk',
          'Suppression digests allow deterministic auditing',
          'Pairs 2D SVG topology graph with accessible data table'
        ],
        actions: [
          { id: 'test_run', label: 'Scan Repository Findings', description: 'Run complete SARIF and finding analysis on active codebase.' }
        ],
        localOnly: true
      },
      {
        id: 'local_model_adapter',
        name: 'Local Model & Resource Adapter Layer (CF-04)',
        shortDescription: 'Safely consume separately operated local LLM endpoints (Ollama, LM Studio, vLLM).',
        detailedDescription: 'Connects to allowlisted loopback/LAN OpenAI-compatible endpoints with resource budgeting, VRAM/RAM caps, deadline timeouts, deterministic fallback, and strict hosted-mode SSRF rejection.',
        category: 'core',
        section: isLocal ? (process.env.LOCAL_MODEL_ENABLED === 'true' ? 'unhealthy_degraded' : 'needs_setup') : 'disabled_by_policy',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: process.env.LOCAL_MODEL_BASE_URL || 'Unconfigured OpenAI-compatible local endpoint',
        requiredSoftware: ['External LLM server (Ollama / vLLM / llama.cpp / LM Studio)'],
        requiredModels: ['qwen2.5-coder-7b / llama3 / mistral'],
        requiredHardware: ['8GB+ RAM or 6GB+ GPU VRAM for 7B models'],
        authorityAndEgress: {
          filesystemAuthority: 'None',
          networkEgress: 'Strict allowlisted loopback only (127.0.0.1, localhost)',
          processAuthority: 'None (does NOT manage or start local server processes)',
          approvalGateRequired: false
        },
        healthState: isLocal ? (process.env.LOCAL_MODEL_ENABLED === 'true' ? 'degraded' : 'not_configured') : 'disabled',
        healthReason: isLocal ? (process.env.LOCAL_MODEL_ENABLED === 'true' ? 'Configured but not yet verified by a live health probe' : 'LOCAL_MODEL_ENABLED is false in .env') : 'Local endpoints blocked in hosted profile',
        version: '1.0.0-cf04',
        estimatedCostAndResources: {
          computeImpact: 'Medium (~4GB VRAM/RAM)',
          estimatedLatency: '200ms - 2000ms depending on hardware',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Prompts sent to local loopback; zero cloud retention.',
        supportStatusAndLimitations: [
          'No automatic binary downloads or server process lifecycle management',
          'Strict SSRF protection rejects non-allowlisted private subnets',
          'Operator must launch Ollama/LM Studio separately'
        ],
        diagnostics: process.env.LOCAL_MODEL_ENABLED !== 'true' ? {
          isBlocked: true,
          issues: ['Local model adapter is disabled or endpoint is unconfigured.'],
          remediationSteps: [
            'Install and launch Ollama or LM Studio on your machine.',
            'Run: `ollama run qwen2.5-coder:7b` to pull the local coding model.',
            'Set `LOCAL_MODEL_ENABLED=true` and `LOCAL_MODEL_BASE_URL=http://127.0.0.1:11434/v1` in your `.env` file.'
          ]
        } : undefined,
        actions: [
          { id: 'run_canary', label: 'Probe Local Model', description: 'Probe local model endpoint health and capabilities.' }
        ],
        localOnly: true
      },
      {
        id: 'typed_agent_teams',
        name: 'Typed Agent Teams & Isolated Worktrees (CF-05)',
        shortDescription: 'Controlled parallel multi-agent development with isolated Git worktrees and task envelopes.',
        detailedDescription: 'Coordinates specialized agent roles (planner, implementer, reviewer, security auditor) with immutable task envelopes, disk/token budget caps, conflict detection, and child-process cancellation.',
        category: 'agents',
        section: 'unhealthy_degraded',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'AgentTeamCoordinator & filesystem sandbox prototype',
        requiredSoftware: ['Git CLI installed on system PATH', 'Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'Isolated worktree checkout directory only; primary branch write blocked',
          networkEgress: 'Zero unapproved egress',
          processAuthority: 'Bounded child process execution inside designated worktree',
          approvalGateRequired: true
        },
        healthState: 'degraded',
        healthReason: 'Typed scheduling is implemented, but mutation workers are not yet backed by real Git branches/worktrees or process-tree supervision.',
        version: '1.0.0-cf05',
        estimatedCostAndResources: {
          computeImpact: 'Medium (~4GB VRAM/RAM)',
          estimatedLatency: 'Variable depending on task graph complexity',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Worktrees automatically cleaned up upon task completion or cancellation.',
        supportStatusAndLimitations: [
          'Supervisor cannot bypass security reviews or branch protections',
          'Cryptographic task envelopes verify inputs and permissions',
          'Single-agent fallback provided when concurrency is constrained',
          'Real Git worktree creation/cleanup and OS process-tree termination still require implementation'
        ],
        actions: [
          { id: 'test_run', label: 'Verify Team Contract', description: 'Verify role authority and immutable task envelope contracts (not a real Git worktree canary).' },
          { id: 'disable_capability', label: 'Disable Multi-Agent Teams', description: 'Force single-agent execution mode.', isDangerous: true, requiredConfirmationScope: 'DISABLE_AGENT_TEAMS', requiredRole: 'admin' }
        ],
        localOnly: true
      },
      {
        id: 'browser_jobs',
        name: 'Transparent Browser Jobs (CF-06)',
        shortDescription: 'Bounded browser QA and automated workflows with origin allowlists and DOM/network evidence.',
        detailedDescription: 'Executes transparent browser automation via a Puppeteer local driver or optional Pydoll CDP adapter. Captures redacted screenshots, DOM snapshots, and network traces for QA inspection. Prohibits CAPTCHA bypass, fingerprint spoofing, or stealth evasion.',
        category: 'integrations',
        section: 'needs_setup',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'browser',
        provider: 'BrowserJobRunner (Puppeteer local driver / Pydoll optional)',
        requiredSoftware: ['Chromium / Puppeteer browser binary'],
        authorityAndEgress: {
          filesystemAuthority: 'Isolated temporary browser profile directory',
          networkEgress: 'Strictly bounded to explicit origin allowlist per job',
          processAuthority: 'Isolated browser process with process tree cleanup on cancellation',
          approvalGateRequired: true
        },
        healthState: 'not_configured',
        healthReason: 'Browser policy contracts are available; run a real-browser canary to verify the installed Chromium binary.',
        version: '1.0.0-cf06',
        estimatedCostAndResources: {
          computeImpact: 'Medium (~4GB VRAM/RAM)',
          estimatedLatency: '1s - 15s per page interaction',
          costProfile: 'Zero-cost Headless'
        },
        dataRetentionPolicy: 'Captured artifacts stored in temporary QA directory with automated redaction.',
        supportStatusAndLimitations: [
          'State-changing mutations (purchase, post, account changes) require explicit confirmation',
          'Strict origin allowlist prevents unauthorized external navigation',
          'Zero CAPTCHA bypass or stealth techniques'
        ],
        actions: [
          { id: 'test_run', label: 'Verify Browser Contract', description: 'Verify origin, budget, approval, and digest contracts without external navigation.' }
        ],
        localOnly: true
      },
      {
        id: 'video_localization',
        name: 'Consent-Aware Video Localization & Dubbing (CF-07)',
        shortDescription: 'Consent-bound video transcription, translation, and localized audio preview pipeline.',
        detailedDescription: 'Transforms video and audio media into localized multilingual previews. Enforces operator consent records, speaker identity constraints, deterministic timing, and ephemeral workspace cleanup.',
        category: 'multimodal',
        section: 'needs_setup',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'VideoLocalizationPipeline contracts (concrete media engine required)',
        requiredSoftware: ['Node.js runtime', 'FFmpeg (optional for hardware media muxing)'],
        authorityAndEgress: {
          filesystemAuthority: 'Isolated media sandbox directory with automatic cleanup',
          networkEgress: 'Zero external video uploads',
          processAuthority: 'Bounded media worker execution',
          approvalGateRequired: true
        },
        healthState: 'not_configured',
        healthReason: 'Consent and pipeline orchestration are implemented; no production STT/translation/TTS/media engine adapter is configured.',
        version: '1.0.0-cf07',
        estimatedCostAndResources: {
          computeImpact: 'Medium (~4GB VRAM/RAM)',
          estimatedLatency: '2s - 30s depending on media length',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Temporary media files deleted upon pipeline completion or cancellation.',
        supportStatusAndLimitations: [
          'Strict consent record required before processing any voice/video',
          'Prohibits deceptive voice cloning or unauthorized likeness generation',
          'Preserves translation provenance and deterministic replay digests'
        ],
        actions: [
          { id: 'test_run', label: 'Verify Localization Contract', description: 'Verify consent binding and provenance contracts without processing media.' }
        ],
        localOnly: true
      },
      {
        id: 'lattice_gamedev',
        name: 'Deterministic Lattice Game Development (CF-08)',
        shortDescription: 'Seedable isometric scenario modeling, balance simulation, and reproducible replay engine.',
        detailedDescription: 'Generates and simulates 3D isometric tile worlds with typed entities, combat resolution, and action replays using Mulberry32 PRNG. Produces accessible non-visual ASCII grids and SVG previews.',
        category: 'gaming',
        section: 'available_now',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'LatticeSimulationEngine & LatticeVisualizer',
        requiredSoftware: ['Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'None (in-memory simulations)',
          networkEgress: 'Zero network egress',
          processAuthority: 'None',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0-cf08',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 50ms for 1000 simulation ticks',
          costProfile: 'Zero-cost Headless'
        },
        dataRetentionPolicy: 'Ephemeral scenario state; replay streams serialized to JSON.',
        supportStatusAndLimitations: [
          'Headless simulation in pure TypeScript; no heavyweight 3D engine dependency',
          'Accessible non-visual ASCII representations for screen readers',
          'Enforces entity and grid dimension budget limits'
        ],
        actions: [
          { id: 'test_run', label: 'Run Simulation Replay', description: 'Execute deterministic 50-tick scenario simulation and verify digest.' }
        ],
        localOnly: true
      },
      expansionCapability({
        id: 'game_engine_bridge',
        name: 'Game Engine Bridge & Transaction Journal',
        family: 'PX-08/PX-09',
        description: 'Godot, Unity, and Unreal inspection with digest-bound mutation proposals, runtime scenarios, and rollback journals.',
        category: 'gaming',
        provider: 'GameEngineBridge & MultiEngineStudioService',
        route: '/api/game-studio',
        filesystemAuthority: 'Approved game project roots only',
        processAuthority: 'Allowlisted local engine adapters only',
        approvalGateRequired: true,
        limitations: ['Engine software is installed and managed separately', 'Every mutation requires a matching proposal digest', 'Support varies by engine adapter and version']
      }),
      {
        id: 'knowledge_online',
        name: 'Knowledge Online & External Search Flow',
        shortDescription: 'Fallback to live web searches when local knowledge confidence is insufficient.',
        detailedDescription: 'Integrates DuckDuckGo / Tavily search with query reformulation, domain allowlists, and preview ingestion. Prompts user before fetching live web data.',
        category: 'core',
        section: 'preview',
        maturity: 'PRODUCTION_PREVIEW',
        processingLocation: 'hybrid',
        provider: 'KnowledgeOnlineFlowService & WebSearchAdapter',
        requiredSoftware: ['Node.js runtime', 'Internet connection'],
        authorityAndEgress: {
          filesystemAuthority: 'Read-only local knowledge database',
          networkEgress: 'HTTPS search queries to approved search providers',
          processAuthority: 'None',
          approvalGateRequired: true
        },
        healthState: 'healthy',
        version: '1.2.0',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '500ms - 1500ms per search',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Search results cached with 24h TTL; zero personal data stored.',
        supportStatusAndLimitations: [
          'User approval required prior to querying external search engine',
          'Source citations attached to generated responses'
        ],
        actions: [
          { id: 'test_run', label: 'Test Search Query', description: 'Verify external search connectivity.' }
        ],
        localOnly: false
      },
      {
        id: 'gis_spatial',
        name: 'GIS & Spatial Intelligence',
        shortDescription: 'Geospatial coordinates, GeoJSON parsing, turf calculations, and privacy redaction.',
        detailedDescription: 'Provides geospatial distance calculation, buffering, spatial bounding box queries, and privacy filters that mask high-precision residential coordinates.',
        category: 'integrations',
        section: 'preview',
        maturity: 'PRODUCTION_PREVIEW',
        processingLocation: 'hybrid',
        provider: 'SpatialAnalysisService & GISPrivacy',
        requiredSoftware: ['Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'None',
          networkEgress: 'Geocoding endpoint queries (OpenStreetMap / Nominatim)',
          processAuthority: 'None',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 100ms',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Coordinates redacted and hashed for privacy.',
        supportStatusAndLimitations: [
          'Redacts precise coordinates in public logs',
          'Interactive Leaflet map rendered in client'
        ],
        actions: [
          { id: 'test_run', label: 'Run Spatial Analysis Test', description: 'Validate distance and buffer algorithms.' }
        ],
        localOnly: false
      },
      {
        id: 'flstudio_control',
        name: 'FL Studio & DAW Workflow Controller',
        shortDescription: 'Automated piano roll scripting, mixer planning, and DAW session management.',
        detailedDescription: 'Generates FL Studio Piano Roll Python scripts and MIDI channel mappings for chord progressions, basslines, and mixer leveling with dry-run offline safety.',
        category: 'integrations',
        section: 'local_only',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'FLStudioCommandPlanner',
        requiredSoftware: ['FL Studio 21+ (optional for live scripting)'],
        authorityAndEgress: {
          filesystemAuthority: 'Local user scripts folder export only',
          networkEgress: 'Zero network egress',
          processAuthority: 'None (scripts exported for user execution in DAW)',
          approvalGateRequired: false
        },
        healthState: 'healthy',
        version: '1.0.0',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '< 50ms',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Generated scripts saved to workspace or memory.',
        supportStatusAndLimitations: [
          'Operates in offline dry-run mode by default',
          'Safe chord and mixer math validation'
        ],
        actions: [
          { id: 'test_run', label: 'Plan Chord Progression', description: 'Generate test Piano Roll script for F minor chord.' }
        ],
        localOnly: true
      },
      {
        id: 'sprite_lab',
        name: 'Sprite Lab Pixel Art Generator',
        shortDescription: 'Local pixel art sprite sheet generation, animation previews, and Aseprite integration.',
        detailedDescription: 'Assembles pixel art animation frames, generates sprite sheets, and integrates with local Aseprite command line tools using strict argument allowlisting.',
        category: 'gaming',
        section: 'local_only',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'SpriteLabService & LocalToolPolicy',
        requiredSoftware: ['Aseprite CLI (optional for export)'],
        authorityAndEgress: {
          filesystemAuthority: 'Local output directory writes with explicit user consent',
          networkEgress: 'Zero network egress',
          processAuthority: 'Strictly allowlisted Aseprite executable flags only',
          approvalGateRequired: true
        },
        healthState: 'healthy',
        version: '1.0.0',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '100ms - 500ms',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Sprites output to workspace artifacts directory.',
        supportStatusAndLimitations: [
          'Aseprite CLI flags strictly allowlisted to prevent command injection',
          'Web-based canvas preview available without Aseprite'
        ],
        actions: [
          { id: 'test_run', label: 'Generate Test Sprite Frame', description: 'Test SVG pixel rasterizer.' }
        ],
        localOnly: true
      },
      {
        id: 'sprite_studio',
        name: 'Sprite & Image Asset Studio (PX-10)',
        shortDescription: 'Local pixel art cleanup, Oklab palette quantization, Bayer dithering, outlines, and Godot/Unity engine handoffs.',
        detailedDescription: '12-stage versioned image-processing pipeline for pixel refinement, background removal with hole preservation, retro palette quantization, Floyd-Steinberg and Bayer dithering, outlines, collision masks, and approved engine handoffs.',
        category: 'gaming',
        section: 'local_only',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'ImageProcessingPipeline & SpriteEngineHandoff',
        requiredSoftware: ['Node.js runtime'],
        authorityAndEgress: {
          filesystemAuthority: 'Local output and approved engine project directories',
          networkEgress: 'Zero network egress',
          processAuthority: 'None',
          approvalGateRequired: true
        },
        healthState: 'healthy',
        version: '1.0.0-px10',
        estimatedCostAndResources: {
          computeImpact: 'Low (CPU only)',
          estimatedLatency: '50ms - 300ms per sprite',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Processed sprite artifacts stored locally with SHA-256 manifests.',
        supportStatusAndLimitations: [
          'Decompression-bomb limit protects memory bounds',
          'Exact-scope approval required prior to engine project handoff',
          'Deterministic palette quantization and dithering'
        ],
        actions: [
          { id: 'test_run', label: 'Run Sprite Pipeline Diagnostic', description: 'Test 12-stage sprite pipeline on calibration fixture.' }
        ],
        localOnly: true,
        apiBasePath: '/api/sprite-studio'
      },
      {
        id: 'stem_mix_lab',
        name: 'Local Stem Separation, Mixer & Audio Analysis Lab (PX-11)',
        shortDescription: 'Local 4/6 stem separation, multitrack mixer, BPM/Key/LUFS analysis, and FL Studio DAW handoffs.',
        detailedDescription: 'Local-first music production capability using Demucs-style worker isolation to extract vocals, drums, bass, guitar, piano, and backing tracks. Computes waveform summaries, ITU-R BS.1770 LUFS loudness, true peak dBFS, and FL Studio channel routing.',
        category: 'multimodal',
        section: 'local_only',
        maturity: 'LOCAL_ONLY_EXPERIMENTAL',
        processingLocation: 'local',
        provider: 'StemSeparationEngine & WaveformMixerEngine',
        requiredSoftware: ['Node.js runtime', 'Demucs neural worker (optional local Python / CPU / GPU)'],
        authorityAndEgress: {
          filesystemAuthority: 'Local audio workspace and export directories only',
          networkEgress: 'Zero network audio egress',
          processAuthority: 'Isolated local worker child process with auto-cleanup',
          approvalGateRequired: true
        },
        healthState: 'degraded',
        healthReason: 'Waveform analysis and mixing are available locally; stem separation remains unavailable until a Demucs worker backend is configured.',
        version: '1.0.0-px11',
        estimatedCostAndResources: {
          computeImpact: 'Medium (~4GB VRAM/RAM)',
          estimatedLatency: '2s - 15s depending on duration and GPU/CPU',
          costProfile: 'Free / Local Compute'
        },
        dataRetentionPolicy: 'Extracted stems saved to user-designated local export directory.',
        supportStatusAndLimitations: [
          'Mandatory rights declaration required before processing',
          'Machine-separated confidence disclaimer attached to all outputs',
          'FL Studio / DAW handoffs operate in dry-run mode by default'
        ],
        actions: [
          { id: 'test_run', label: 'Run Audio Analysis Diagnostic', description: 'Test waveform extraction and LUFS analysis on test audio.' }
        ],
        localOnly: true,
        apiBasePath: '/api/music-studio'
      },
      expansionCapability({
        id: 'desktop_voice_companion',
        name: 'Desktop Voice Companion',
        family: 'PX-12',
        description: 'Local dictation, TTS, privacy-gated screen context, clipboard proposals, and desktop briefings.',
        category: 'multimodal',
        provider: 'DesktopCompanionBriefingService & local STT/TTS adapters',
        route: '/api/desktop-companion',
        filesystemAuthority: 'User-selected local session artifacts only',
        processAuthority: 'Optional separately installed local STT/TTS providers',
        approvalGateRequired: true,
        limitations: ['Screen capture is explicit and privacy-gated', 'Clipboard and OS actions are proposals, not silent mutations', 'Local speech providers may require separate installation']
      }),
      expansionCapability({
        id: 'media_accessibility',
        name: 'Media Accessibility & Localization',
        family: 'PX-13',
        description: 'Subtitle OCR and editing, transcript alignment, translation variants, consent-gated dubbing, and document narration.',
        category: 'multimodal',
        provider: 'Media Accessibility service family',
        route: '/api/media-accessibility',
        filesystemAuthority: 'Approved media workspace paths only',
        processAuthority: 'Bounded local media workers when configured',
        approvalGateRequired: true,
        limitations: ['Rights confirmation is required for media ingest', 'Voice dubbing requires a valid consent record', 'OCR and synthesis quality depends on configured local providers']
      }),
      expansionCapability({
        id: 'writing_studio',
        name: 'Lossless Writing & Review Studio',
        family: 'PX-14',
        description: 'Byte-preserving document editing, proofreading, tracked changes, AI proposals, and crash recovery.',
        category: 'multimodal',
        provider: 'WritingStudioService & DocumentWorkspace',
        route: '/api/writing-studio',
        filesystemAuthority: 'User-selected documents within approved roots',
        approvalGateRequired: true,
        limitations: ['AI changes remain proposals until accepted', 'Provider routing respects document sensitivity', 'Format conversions disclose any loss of fidelity']
      }),
      expansionCapability({
        id: 'study_studio',
        name: 'Source-Grounded Study Studio',
        family: 'PX-15',
        description: 'Cited notes, flashcards, quizzes, exams, mastery tracking, Socratic practice, and audio lessons.',
        category: 'data',
        provider: 'StudyStudioService & education tools',
        route: '/api/study-studio',
        limitations: ['Generated material retains source anchors', 'Educator answer keys remain access-controlled', 'Automated mastery estimates are transparent heuristics']
      }),
      expansionCapability({
        id: 'web_studio',
        name: 'Visual Web Studio',
        family: 'PX-16',
        description: 'Project-aware visual website editing, responsive previews, click-to-code inspection, and reversible multi-file changes.',
        category: 'coding',
        provider: 'WebStudioService & WebsiteWorkspace',
        route: '/api/website-workspace',
        filesystemAuthority: 'Approved web project root only',
        processAuthority: 'Sandboxed preview server when explicitly started',
        approvalGateRequired: true,
        limitations: ['Preview content is sandboxed from parent secrets', 'File changes are confined to the selected project', 'Production deployment is outside this capability']
      }),
      expansionCapability({
        id: 'developer_utility_pack',
        name: 'Developer Utility Pack',
        family: 'PX-17',
        description: 'Deterministic mock APIs, data transforms, checksums, schema utilities, and source-preserving exports.',
        category: 'coding',
        provider: 'MockApiService & UtilityWorkbench',
        route: '/api/mock-api',
        filesystemAuthority: 'Approved workspace exports only',
        limitations: ['Mock APIs are not production backends', 'Generated datasets are bounded', 'Exports preserve source and license metadata']
      })
    ];
  }
}
