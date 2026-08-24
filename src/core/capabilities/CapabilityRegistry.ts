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

    return evaluatedList;
  }

  public clearOverrides(): void {
    this.capabilityOverrides.clear();
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
        this.capabilityOverrides.set(capabilityId, {
          section: 'disabled_by_policy',
          healthState: 'disabled',
          healthReason: 'Explicitly disabled by operator.'
        });
        return { success: true, message: `Capability '${capability.name}' has been disabled.` };
      }

      case 'enable_capability': {
        this.capabilityOverrides.delete(capabilityId);
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

    return [
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
      }
    ];
  }
}
