/**
 * Capability Dashboard and Operational Runbook Service (PX20-T09)
 * Generates operational dashboard summaries and runbook guidance for:
 * 1. Capability Platform
 * 2. Context Economy & Memory
 * 3. Agent Operations & Teams
 * 4. Local Models & Inference
 * 5. Engine Adapters (Godot, Unity)
 * 6. Media / Audio / Image Workers
 * 7. Writing / Study / Web Studios
 * 8. Artifacts & Storage Quotas
 * 9. Security, Approvals & Safety
 */

export interface OperationalRunbook {
  id: string;
  domain: string;
  triggerCondition: string;
  severity: 'info' | 'warning' | 'critical';
  mitigationSteps: string[];
  escalationOwner: string;
}

export interface DomainDashboardState {
  domainId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  summaryMetrics: Record<string, string | number>;
  activeAlerts: string[];
  applicableRunbooks: OperationalRunbook[];
}

export class CapabilityDashboardService {
  private static instance: CapabilityDashboardService;

  public static getInstance(): CapabilityDashboardService {
    if (!CapabilityDashboardService.instance) {
      CapabilityDashboardService.instance = new CapabilityDashboardService();
    }
    return CapabilityDashboardService.instance;
  }

  public getRunbooks(): OperationalRunbook[] {
    return [
      {
        id: 'runbook-adapter-disconnect',
        domain: 'engine_adapters',
        triggerCondition: 'Game engine LSP or debug port connection dropped',
        severity: 'warning',
        mitigationSteps: [
          'Verify Godot/Unity editor process is active and project is loaded',
          'Check firewall/loopback permissions on port 6005/6008',
          'Trigger AdapterFailureMatrix auto-reconnect drill'
        ],
        escalationOwner: 'Gamedev Studio Integrations (@game-ops)'
      },
      {
        id: 'runbook-low-disk',
        domain: 'storage_artifacts',
        triggerCondition: 'Free disk drops below lowDiskRefusalThresholdMb (500MB)',
        severity: 'critical',
        mitigationSteps: [
          'Run StorageQuotaManager preview to identify reclaimable temp/cache files',
          'Execute automated non-destructive storage sweep',
          'Verify protected artifacts were retained without data loss'
        ],
        escalationOwner: 'Infrastructure & Storage Team (@infra-ops)'
      },
      {
        id: 'runbook-vram-exhaustion',
        domain: 'local_models',
        triggerCondition: 'Local model resource manager rejects lease due to VRAM overflow',
        severity: 'warning',
        mitigationSteps: [
          'Inspect active background model workers and unload inactive model instances',
          'Reduce context window batch size or switch to template fallback',
          'Check hardware telemetry for background GPU contention'
        ],
        escalationOwner: 'Local Inference Team (@model-ops)'
      },
      {
        id: 'runbook-approval-timeout',
        domain: 'security_approvals',
        triggerCondition: 'High-risk capability action approval expired without operator confirmation',
        severity: 'info',
        mitigationSteps: [
          'Job transitioned automatically to CANCELLED state (safe default)',
          'Prompt user to re-request operation with fresh confirmation digest if still required'
        ],
        escalationOwner: 'Security & Approvals Gatekeeper (@sec-ops)'
      }
    ];
  }

  public getDashboardOverview(): DomainDashboardState[] {
    const runbooks = this.getRunbooks();

    return [
      {
        domainId: 'platform',
        name: 'Capability Platform Core',
        status: 'healthy',
        summaryMetrics: { totalPacks: 12, enabledPacks: 10, registryHealth: '100%' },
        activeAlerts: [],
        applicableRunbooks: []
      },
      {
        domainId: 'context_memory',
        name: 'Context Economy & Project Memory',
        status: 'healthy',
        summaryMetrics: { avgCompressionSavings: '42%', activeMemories: 148, freshRatio: '98%' },
        activeAlerts: [],
        applicableRunbooks: []
      },
      {
        domainId: 'agent_operations',
        name: 'Agent Operations & Worktrees',
        status: 'healthy',
        summaryMetrics: { activeSessions: 0, worktreeClaims: 0, mergeConflicts: 0 },
        activeAlerts: [],
        applicableRunbooks: []
      },
      {
        domainId: 'local_models',
        name: 'Local Models & Hardware Leases',
        status: 'healthy',
        summaryMetrics: { vramAllocatedMb: 0, vramCapacityMb: 8192, leasesActive: 0 },
        activeAlerts: [],
        applicableRunbooks: runbooks.filter(r => r.domain === 'local_models')
      },
      {
        domainId: 'engine_adapters',
        name: 'Game Engine Adapters (Godot)',
        status: 'healthy',
        summaryMetrics: { connectedEngines: 1, lastSyncMs: 45 },
        activeAlerts: [],
        applicableRunbooks: runbooks.filter(r => r.domain === 'engine_adapters')
      },
      {
        domainId: 'media_workers',
        name: 'Media, Audio & Sprite Processing',
        status: 'healthy',
        summaryMetrics: { workersActive: 0, jobsProcessedToday: 18 },
        activeAlerts: [],
        applicableRunbooks: []
      },
      {
        domainId: 'studios',
        name: 'Writing, Study & Web Studios',
        status: 'healthy',
        summaryMetrics: { activeWorkspaces: 3, documentDiffAccuracy: '100%' },
        activeAlerts: [],
        applicableRunbooks: []
      },
      {
        domainId: 'storage_artifacts',
        name: 'Artifacts & Storage Quotas',
        status: 'healthy',
        summaryMetrics: { totalArtifactBytesMb: 240, quotaRemainingPercent: 97.6 },
        activeAlerts: [],
        applicableRunbooks: runbooks.filter(r => r.domain === 'storage_artifacts')
      },
      {
        domainId: 'security_approvals',
        name: 'Security, Approvals & Redaction',
        status: 'healthy',
        summaryMetrics: { pendingApprovals: 0, redactionsExecuted: 42 },
        activeAlerts: [],
        applicableRunbooks: runbooks.filter(r => r.domain === 'security_approvals')
      }
    ];
  }
}
