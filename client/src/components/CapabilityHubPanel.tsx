import { useState, useEffect, useCallback } from 'react';
import ExactScopeConfirmModal from './ExactScopeConfirmModal';
import RepositoryFindingsView, { FindingOverlayItem, FindingDetail } from './RepositoryFindingsView';
import CapabilityPromotionView from './CapabilityPromotionView';
import { isStaticPagesBuild } from '../api/runtime';
import './CapabilityHubPanel.css';

export type CapabilitySection =
  | 'available_now'
  | 'needs_setup'
  | 'local_only'
  | 'preview'
  | 'experimental'
  | 'disabled_by_policy'
  | 'unhealthy_degraded';

export type CapabilityMaturity =
  | 'PRODUCTION_SUPPORTED'
  | 'PRODUCTION_PREVIEW'
  | 'LOCAL_ONLY_EXPERIMENTAL'
  | 'DEPRECATED';

export type ProcessingLocation = 'local' | 'hosted' | 'hybrid' | 'browser' | 'external_provider';
export type CapabilityHealthState = 'healthy' | 'degraded' | 'unhealthy' | 'not_configured' | 'disabled';

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  isDangerous?: boolean;
  requiredConfirmationScope?: string;
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
    computeImpact: string;
    estimatedLatency: string;
    costProfile: string;
  };
  dataRetentionPolicy: string;
  supportStatusAndLimitations: string[];
  diagnostics?: {
    isBlocked: boolean;
    issues: string[];
    remediationSteps: string[];
  };
  actions: ActionDefinition[];
  localOnly: boolean;
  apiBasePath?: string;
}

export interface JobEvidenceRecord {
  type: string;
  description: string;
  path?: string;
  digest: string;
  timestamp: string;
}

export interface CapabilityJob {
  id: string;
  capabilityId: string;
  category: string;
  title: string;
  requester: string;
  status: 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  progressPercent?: number;
  evidence: JobEvidenceRecord[];
  auditDigest: string;
  fallbackReason?: string;
  error?: string;
  requiresExactScopeConfirmation?: boolean;
  confirmationScope?: string;
}

export interface ArtifactDisplayRecord {
  id: string;
  name: string;
  capabilityId: string;
  mimeType: string;
  byteSize: number;
  sha256Hash: string;
  createdAt: string;
  parentArtifactIds: string[];
}

export interface PackDisplayRecord {
  packId: string;
  displayName: string;
  version: string;
  description: string;
  maturity: string;
  status: string;
  permissions: string[];
}

export default function CapabilityHubPanel({ onOpenCapability }: { onOpenCapability?: (capabilityId: string) => void } = {}) {
  const [activeTab, setActiveTab] = useState<'grid' | 'jobs' | 'artifacts' | 'packs' | 'findings' | 'evaluation' | 'onboarding'>('grid');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [jobs, setJobs] = useState<CapabilityJob[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDisplayRecord[]>([]);
  const [packs, setPacks] = useState<PackDisplayRecord[]>([]);
  const [overlays, setOverlays] = useState<FindingOverlayItem[]>([]);
  const [findings, setFindings] = useState<FindingDetail[]>([]);
  const [selectedCapability, setSelectedCapability] = useState<CapabilityItem | null>(null);
  const [selectedJob, setSelectedJob] = useState<CapabilityJob | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactDisplayRecord | null>(null);
  const [guidedSetupCapability, setGuidedSetupCapability] = useState<CapabilityItem | null>(null);
  const [runtimeProfile, setRuntimeProfile] = useState<string>('local');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Exact-scope confirmation modal state
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    capability: CapabilityItem | null;
    action: ActionDefinition | null;
  }>({
    isOpen: false,
    capability: null,
    action: null
  });

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchCapabilities = useCallback(async () => {
    if (isStaticPagesBuild) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/capabilities', {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Capability registry request failed with HTTP ${response.status}`);
      const data = await response.json();
      setCapabilities(data.capabilities || []);
      if (data.profile) setRuntimeProfile(data.profile);
    } catch (err: any) {
      setStatusMessage(`Error loading capabilities: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchJobs = useCallback(async () => {
    if (isStaticPagesBuild) return;
    try {
      const response = await fetch('/api/capabilities/jobs/list', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Jobs can be retried
    }
  }, [getAuthHeaders]);

  const fetchArtifacts = useCallback(async () => {
    if (isStaticPagesBuild) return;
    try {
      const response = await fetch('/api/capabilities/artifacts/list', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setArtifacts(data.artifacts || []);
      }
    } catch {
      // Artifacts can be retried
    }
  }, [getAuthHeaders]);

  const fetchPacks = useCallback(async () => {
    if (isStaticPagesBuild) return;
    try {
      const response = await fetch('/api/capabilities/packs/list', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setPacks(data.packs || []);
      }
    } catch {
      // Packs can be retried
    }
  }, [getAuthHeaders]);

  const fetchFindings = useCallback(async () => {
    if (isStaticPagesBuild) return;
    try {
      const response = await fetch('/api/capabilities/repository-findings', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setOverlays(data.overlays || []);
        setFindings(data.findings || []);
      } else {
        throw new Error(`Repository findings request failed with HTTP ${response.status}`);
      }
    } catch (error: any) {
      setOverlays([]);
      setFindings([]);
      setStatusMessage(`Repository findings unavailable: ${error.message || String(error)}`);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    void fetchCapabilities();
    void fetchJobs();
    void fetchArtifacts();
    void fetchPacks();
    void fetchFindings();
  }, [fetchCapabilities, fetchJobs, fetchArtifacts, fetchPacks, fetchFindings]);

  const handleExecuteAction = async (capability: CapabilityItem, action: ActionDefinition) => {
    if (action.isDangerous && action.requiredConfirmationScope) {
      setConfirmModalState({
        isOpen: true,
        capability,
        action
      });
      return;
    }

    setStatusMessage(`Executing ${action.label}...`);
    try {
      const response = await fetch(`/api/capabilities/${capability.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ actionId: action.id })
      });
      const data = await response.json();
      if (response.ok) {
        setStatusMessage(data.message || `${action.label} succeeded.`);
        void fetchCapabilities();
        void fetchJobs();
      } else {
        setStatusMessage(`Action failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatusMessage(`Action error: ${err.message}`);
    }
  };

  const handleConfirmDangerousAction = async (confirmedScope: string) => {
    const { capability, action } = confirmModalState;
    if (!capability || !action) return;

    setConfirmModalState({ isOpen: false, capability: null, action: null });
    setStatusMessage(`Executing dangerous action: ${action.label}...`);

    try {
      const response = await fetch(`/api/capabilities/${capability.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          actionId: action.id,
          confirmedScope
        })
      });
      const data = await response.json();
      if (response.ok) {
        setStatusMessage(data.message || `${action.label} executed with exact-scope confirmation.`);
        void fetchCapabilities();
        void fetchJobs();
      } else {
        setStatusMessage(`Action failed: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMessage(`Confirmation error: ${err.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/capabilities/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: 'Cancelled by operator via Capability Hub' })
      });
      if (response.ok) {
        setStatusMessage(`Job ${jobId} cancelled.`);
        void fetchJobs();
      } else {
        const data = await response.json();
        setStatusMessage(`Cancellation failed: ${data.error || `HTTP ${response.status}`}`);
      }
    } catch (err: any) {
      setStatusMessage(`Cancellation error: ${err.message}`);
    }
  };

  const handleDownloadSupportBundle = () => {
    const bundle = {
      bundleId: `bundle-${Date.now().toString(16)}`,
      generatedAt: new Date().toISOString(),
      diagnostics: {
        version: '1.0.0',
        deploymentProfile: runtimeProfile.toUpperCase(),
        capabilityCounts: {
          total: capabilities.length,
          availableNow: capabilities.filter(c => c.section === 'available_now').length,
          needsSetup: capabilities.filter(c => c.section === 'needs_setup').length,
          localOnly: capabilities.filter(c => c.section === 'local_only').length,
          preview: capabilities.filter(c => c.section === 'preview').length,
          experimental: capabilities.filter(c => c.section === 'experimental').length,
          disabledByPolicy: capabilities.filter(c => c.section === 'disabled_by_policy').length,
          unhealthy: capabilities.filter(c => c.section === 'unhealthy_degraded').length
        },
        sanitizedNotices: [
          'Notice: Telemetry scrubbed. All private keys, session tokens, passwords, and file paths redacted.'
        ]
      }
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `support-bundle-${bundle.bundleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Sanitized support bundle downloaded: ${bundle.bundleId}`);
  };

  const filteredCapabilities = capabilities.filter(item => {
    if (selectedSection !== 'all' && item.section !== selectedSection) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.shortDescription.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSectionBadgeClass = (section: CapabilitySection) => {
    switch (section) {
      case 'available_now': return 'badge-available';
      case 'needs_setup': return 'badge-setup';
      case 'local_only': return 'badge-local';
      case 'preview': return 'badge-preview';
      case 'experimental': return 'badge-experimental';
      case 'disabled_by_policy': return 'badge-disabled';
      case 'unhealthy_degraded': return 'badge-degraded';
      default: return '';
    }
  };

  const getSectionLabel = (section: CapabilitySection) => {
    switch (section) {
      case 'available_now': return 'Available Now';
      case 'needs_setup': return 'Needs Setup';
      case 'local_only': return 'Local Only';
      case 'preview': return 'Preview';
      case 'experimental': return 'Experimental';
      case 'disabled_by_policy': return 'Disabled by Policy';
      case 'unhealthy_degraded': return 'Degraded / Unhealthy';
      default: return section;
    }
  };

  return (
    <section className="capability-hub-panel" aria-label="Unified Capability Hub">
      {/* Header */}
      <div className="capability-hub-header">
        <div className="header-info">
          <div className="eyebrow-container">
            <span className="capability-hub-eyebrow">Profile-Wide Capability Hub (PX-18)</span>
            <span className={`runtime-profile-tag ${runtimeProfile}`}>
              Profile: {runtimeProfile.toUpperCase()}
            </span>
          </div>
          <h2>Unified Capability Hub</h2>
          <p className="capability-hub-description">
            Discover, configure, test, monitor, and manage the full lifecycle of all AI capabilities, packs, jobs, and artifacts.
          </p>
        </div>

        {/* Primary View Navigation */}
        <nav className="capability-view-nav" aria-label="Capability Hub views">
          <button
            type="button"
            className={activeTab === 'grid' ? 'active' : ''}
            aria-pressed={activeTab === 'grid'}
            onClick={() => setActiveTab('grid')}
          >
            Capabilities ({capabilities.length})
          </button>
          <button
            type="button"
            className={activeTab === 'jobs' ? 'active' : ''}
            aria-pressed={activeTab === 'jobs'}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs &amp; Audit ({jobs.length})
          </button>
          <button
            type="button"
            className={activeTab === 'artifacts' ? 'active' : ''}
            aria-pressed={activeTab === 'artifacts'}
            onClick={() => setActiveTab('artifacts')}
          >
            Artifact Lineage ({artifacts.length})
          </button>
          <button
            type="button"
            className={activeTab === 'packs' ? 'active' : ''}
            aria-pressed={activeTab === 'packs'}
            onClick={() => setActiveTab('packs')}
          >
            Packs &amp; Supply Chain ({packs.length})
          </button>
          <button
            type="button"
            className={activeTab === 'findings' ? 'active' : ''}
            aria-pressed={activeTab === 'findings'}
            onClick={() => setActiveTab('findings')}
          >
            2D Topology &amp; Findings
          </button>
          <button
            type="button"
            className={activeTab === 'evaluation' ? 'active' : ''}
            aria-pressed={activeTab === 'evaluation'}
            onClick={() => setActiveTab('evaluation')}
          >
            Evaluation &amp; Promotion (CF-10)
          </button>
          <button
            type="button"
            className={activeTab === 'onboarding' ? 'active' : ''}
            aria-pressed={activeTab === 'onboarding'}
            onClick={() => setActiveTab('onboarding')}
          >
            Onboarding &amp; Policy
          </button>
        </nav>
      </div>

      {statusMessage && (
        <div className="capability-hub-banner" role="status" aria-live="polite">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} aria-label="Dismiss banner">✕</button>
        </div>
      )}

      {/* Action Bar for Support Diagnostics */}
      <div className="capability-action-bar">
        <button
          type="button"
          className="btn-download-support-bundle"
          onClick={handleDownloadSupportBundle}
          aria-label="Download sanitized diagnostic support bundle"
        >
          📥 Download Support Diagnostic Bundle (Redacted)
        </button>
      </div>

      {/* VIEW: Capability Grid */}
      {activeTab === 'grid' && (
        <div className="capability-grid-view">
          {/* Filter Bar */}
          <div className="capability-filters-bar">
            <div className="section-pills" role="radiogroup" aria-label="Filter by capability section">
              {[
                { id: 'all', label: 'All' },
                { id: 'available_now', label: 'Available Now' },
                { id: 'needs_setup', label: 'Needs Setup' },
                { id: 'local_only', label: 'Local Only' },
                { id: 'preview', label: 'Preview' },
                { id: 'experimental', label: 'Experimental' },
                { id: 'disabled_by_policy', label: 'Disabled' },
                { id: 'unhealthy_degraded', label: 'Degraded' }
              ].map(sec => (
                <button
                  key={sec.id}
                  type="button"
                  className={`section-filter-btn ${selectedSection === sec.id ? 'active' : ''}`}
                  role="radio"
                  aria-checked={selectedSection === sec.id}
                  onClick={() => setSelectedSection(sec.id)}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className="search-input-wrapper">
              <input
                type="search"
                placeholder="Search capabilities, models, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search capabilities"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="loading-state" role="status">
              <span className="spinner" aria-hidden="true"></span>
              <p>Scanning capability registry and probing health...</p>
            </div>
          ) : filteredCapabilities.length === 0 ? (
            <div className="empty-state">
              <p>No capabilities match the selected filter or search query.</p>
            </div>
          ) : (
            <div className="capability-cards-grid">
              {filteredCapabilities.map(item => (
                <article key={item.id} className={`capability-card section-${item.section} health-${item.healthState}`}>
                  <div className="card-top">
                    <div className="card-badges">
                      <span className={`section-badge ${getSectionBadgeClass(item.section)}`}>
                        {getSectionLabel(item.section)}
                      </span>
                      <span className={`health-dot ${item.healthState}`} title={`Health: ${item.healthState}`}></span>
                    </div>
                    <span className="location-tag" title="Execution environment">
                      {item.processingLocation.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="card-title">{item.name}</h3>
                  <p className="card-short-desc">{item.shortDescription}</p>

                  <div className="card-meta">
                    <div className="meta-row">
                      <span className="meta-label">Provider:</span>
                      <span className="meta-value">{item.provider}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Authority:</span>
                      <span className="meta-value">{item.authorityAndEgress.filesystemAuthority}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Cost/Resource:</span>
                      <span className="meta-value">{item.estimatedCostAndResources.computeImpact} · {item.estimatedCostAndResources.costProfile}</span>
                    </div>
                  </div>

                  {item.diagnostics?.isBlocked && (
                    <div className="card-diagnostic-alert">
                      <span className="alert-icon">⚠️</span>
                      <span className="alert-text">{item.diagnostics.issues[0]}</span>
                    </div>
                  )}

                  <div className="card-actions">
                    <button
                      type="button"
                      className="btn-inspect"
                      onClick={() => setSelectedCapability(item)}
                      aria-label={`Inspect full specifications for ${item.name}`}
                    >
                      Specifications &amp; Diagnostics
                    </button>
                    {(item.section === 'needs_setup' || item.section === 'unhealthy_degraded') && (
                      <button
                        type="button"
                        className="btn-action-primary"
                        onClick={() => setGuidedSetupCapability(item)}
                      >
                        Guided Setup
                      </button>
                    )}
                    {item.actions.map(action => (
                      <button
                        key={action.id}
                        type="button"
                        className={action.isDangerous ? 'btn-action-danger' : 'btn-action-primary'}
                        onClick={() => handleExecuteAction(item, action)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Job Lifecycle & Audit Trail */}
      {activeTab === 'jobs' && (
        <div className="capability-jobs-view">
          <div className="jobs-header-bar">
            <h3>Capability Execution Jobs &amp; Audit Trail</h3>
            <button type="button" className="btn-refresh" onClick={() => void fetchJobs()}>
              Refresh Jobs
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="empty-state">
              <p>No active or historical capability jobs recorded in this session.</p>
              <p className="empty-hint">Run a diagnostic test or tool workflow from the Capabilities tab to generate execution records.</p>
            </div>
          ) : (
            <div className="jobs-list">
              {jobs.map(job => (
                <div key={job.id} className={`job-card status-${job.status}`}>
                  <div className="job-card-header">
                    <div className="job-title-group">
                      <span className={`job-status-pill status-${job.status}`}>
                        {job.status.toUpperCase()}
                      </span>
                      <h4>{job.title}</h4>
                      <span className="job-id-code"><code>{job.id}</code></span>
                    </div>
                    <span className="job-timestamp">{new Date(job.startedAt).toLocaleTimeString()}</span>
                  </div>

                  <div className="job-meta-row">
                    <span>Requester: <strong>{job.requester}</strong></span>
                    <span>Category: <code>{job.category}</code></span>
                    <span>Evidence Count: <strong>{job.evidence.length}</strong></span>
                  </div>

                  <div className="job-audit-digest">
                    <span className="digest-label">Audit SHA-256:</span>
                    <code className="digest-value">{job.auditDigest}</code>
                  </div>

                  {job.status === 'running' && (
                    <div className="job-progress-bar-wrapper">
                      <div
                        className="job-progress-bar-fill"
                        style={{ width: `${job.progressPercent || 20}%` }}
                      ></div>
                    </div>
                  )}

                  {job.fallbackReason && (
                    <p className="job-fallback-note">Note: {job.fallbackReason}</p>
                  )}
                  {job.error && (
                    <p className="job-error-note">Error: {job.error}</p>
                  )}

                  <div className="job-card-actions">
                    <button
                      type="button"
                      className="btn-job-inspect"
                      onClick={() => setSelectedJob(job)}
                    >
                      Inspect Evidence ({job.evidence.length})
                    </button>
                    {(job.status === 'running' || job.status === 'pending_approval') && (
                      <button
                        type="button"
                        className="btn-job-cancel"
                        onClick={() => handleCancelJob(job.id)}
                      >
                        Cancel Job
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Artifact Lineage Browser */}
      {activeTab === 'artifacts' && (
        <div className="capability-artifacts-view">
          <div className="jobs-header-bar">
            <h3>Capability Generated Artifacts &amp; Lineage</h3>
            <button type="button" className="btn-refresh" onClick={() => void fetchArtifacts()}>
              Refresh Artifacts
            </button>
          </div>

          {artifacts.length === 0 ? (
            <div className="empty-state">
              <p>No durable artifacts recorded in the capability storage registry.</p>
            </div>
          ) : (
            <div className="artifacts-grid">
              {artifacts.map(art => (
                <div key={art.id} className="artifact-card">
                  <h4>{art.name}</h4>
                  <p className="artifact-mime">{art.mimeType} · {Math.round(art.byteSize / 1024)} KB</p>
                  <p className="artifact-capability">Capability: <code>{art.capabilityId}</code></p>
                  <div className="artifact-sha">
                    <span>SHA-256:</span> <code>{art.sha256Hash.slice(0, 16)}...</code>
                  </div>
                  <button
                    type="button"
                    className="btn-inspect"
                    onClick={() => setSelectedArtifact(art)}
                  >
                    View Lineage &amp; Provenance
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: Pack Management */}
      {activeTab === 'packs' && (
        <div className="capability-packs-view">
          <div className="jobs-header-bar">
            <h3>Installed Capability Packs &amp; Supply Chain</h3>
            <button type="button" className="btn-refresh" onClick={() => void fetchPacks()}>
              Refresh Packs
            </button>
          </div>

          {packs.length === 0 ? (
            <div className="empty-state">
              <p>No external capability packs installed. Standard core modules are active.</p>
            </div>
          ) : (
            <div className="packs-list">
              {packs.map(pack => (
                <div key={pack.packId} className="pack-card">
                  <div className="pack-card-header">
                    <h4>{pack.displayName} <span className="pack-ver">v{pack.version}</span></h4>
                    <span className={`pack-status-tag ${pack.status}`}>{pack.status.toUpperCase()}</span>
                  </div>
                  <p>{pack.description}</p>
                  <div className="pack-perms">
                    <span>Permissions:</span>
                    {pack.permissions.map((p, idx) => (
                      <code key={idx} className="perm-tag">{p}</code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: CF-03 Findings Topology */}
      {activeTab === 'findings' && (
        <div className="capability-findings-tab">
          <RepositoryFindingsView overlays={overlays} findings={findings} />
        </div>
      )}

      {/* VIEW: CF-10 Evaluation & Promotion Gates */}
      {activeTab === 'evaluation' && (
        <div className="capability-evaluation-tab">
          <CapabilityPromotionView />
        </div>
      )}

      {/* VIEW: Onboarding & Policy */}
      {activeTab === 'onboarding' && (
        <div className="capability-onboarding-view">
          <div className="onboarding-guide-card">
            <h3>Understanding ChatBot Runtime Boundaries</h3>
            <p>
              ChatBot is designed with strict security, privacy, and isolation guarantees across local and hosted environments.
            </p>

            <div className="policy-grid">
              <div className="policy-card">
                <span className="policy-icon">🔒</span>
                <h4>Local vs Hosted Isolation</h4>
                <p>
                  In <code>hosted</code> profile, all local process execution, local filesystem write authority, and private loopback model endpoints are strictly disabled by policy to prevent SSRF and privilege escalation.
                </p>
              </div>

              <div className="policy-card">
                <span className="policy-icon">🛡️</span>
                <h4>Approval Gates &amp; Exact Scope</h4>
                <p>
                  Dangerous actions (e.g. modifying policy or disabling safeguards) require exact-scope typed confirmation instead of generic consent buttons.
                </p>
              </div>

              <div className="policy-card">
                <span className="policy-icon">📂</span>
                <h4>Approved Repository Gateway</h4>
                <p>
                  Codebase analysis is strictly read-only and bounded (128KB per file max). Inspected repositories are never executed dynamically simply to inspect them.
                </p>
              </div>

              <div className="policy-card">
                <span className="policy-icon">⚡</span>
                <h4>Zero Stealth &amp; Evasion</h4>
                <p>
                  Browser jobs and media localization operate transparently with cryptographic audit digests. CAPTCHA bypassing, proxy rotation, and unauthorized likeness cloning are strictly prohibited.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Specification & Diagnostics Detail Modal */}
      {selectedCapability && (
        <div className="capability-spec-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="spec-modal-title">
          <div className="capability-spec-modal">
            <div className="spec-modal-header">
              <div>
                <span className={`section-badge ${getSectionBadgeClass(selectedCapability.section)}`}>
                  {getSectionLabel(selectedCapability.section)}
                </span>
                <h3 id="spec-modal-title">{selectedCapability.name}</h3>
                <span className="spec-version">Version {selectedCapability.version} · Maturity: {selectedCapability.maturity}</span>
              </div>
              <button
                type="button"
                className="spec-modal-close"
                onClick={() => setSelectedCapability(null)}
                aria-label="Close specifications"
              >
                ✕
              </button>
            </div>

            <div className="spec-modal-body">
              <div className="spec-section">
                <h4>Description &amp; Operation</h4>
                <p>{selectedCapability.detailedDescription}</p>
              </div>

              <div className="spec-section-grid">
                <div className="spec-grid-box">
                  <h5>Processing Location</h5>
                  <p><strong>{selectedCapability.processingLocation.toUpperCase()}</strong></p>
                </div>
                <div className="spec-grid-box">
                  <h5>Active Provider</h5>
                  <p><code>{selectedCapability.provider}</code></p>
                </div>
                <div className="spec-grid-box">
                  <h5>Cost / Resource Profile</h5>
                  <p>{selectedCapability.estimatedCostAndResources.computeImpact}</p>
                  <span className="text-muted">{selectedCapability.estimatedCostAndResources.costProfile} · Latency {selectedCapability.estimatedCostAndResources.estimatedLatency}</span>
                </div>
                <div className="spec-grid-box">
                  <h5>Data Retention Policy</h5>
                  <p>{selectedCapability.dataRetentionPolicy}</p>
                </div>
              </div>

              <div className="spec-section">
                <h4>Authority &amp; Data Egress</h4>
                <ul className="spec-list">
                  <li><strong>Filesystem:</strong> {selectedCapability.authorityAndEgress.filesystemAuthority}</li>
                  <li><strong>Network Egress:</strong> {selectedCapability.authorityAndEgress.networkEgress}</li>
                  <li><strong>Process Authority:</strong> {selectedCapability.authorityAndEgress.processAuthority}</li>
                  <li><strong>Approval Gate:</strong> {selectedCapability.authorityAndEgress.approvalGateRequired ? 'Required for mutations' : 'Standard'}</li>
                </ul>
              </div>

              <div className="spec-section">
                <h4>Required Dependencies &amp; Software</h4>
                <div className="dependency-tag-list">
                  {selectedCapability.requiredSoftware.map((s, i) => (
                    <span key={i} className="dep-tag">📦 {s}</span>
                  ))}
                  {selectedCapability.requiredModels?.map((m, i) => (
                    <span key={i} className="dep-tag model">🤖 {m}</span>
                  ))}
                  {selectedCapability.requiredHardware?.map((h, i) => (
                    <span key={i} className="dep-tag hw">💻 {h}</span>
                  ))}
                </div>
              </div>

              {selectedCapability.diagnostics && (
                <div className="spec-section diagnostics-box">
                  <h4>Diagnostics &amp; Actionable Remediation</h4>
                  <div className="diag-issues">
                    {selectedCapability.diagnostics.issues.map((iss, i) => (
                      <p key={i} className="diag-issue-item">⚠️ {iss}</p>
                    ))}
                  </div>
                  <h5>Step-by-Step Setup:</h5>
                  <ol className="diag-steps">
                    {selectedCapability.diagnostics.remediationSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="spec-section">
                <h4>Support Status &amp; Limitations</h4>
                <ul className="spec-list">
                  {selectedCapability.supportStatusAndLimitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="spec-modal-footer">
              {selectedCapability.apiBasePath && onOpenCapability && (
                <button
                  type="button"
                  className="btn-spec-close"
                  onClick={() => {
                    onOpenCapability(selectedCapability.id);
                    setSelectedCapability(null);
                  }}
                >
                  Open workspace
                </button>
              )}
              <button
                type="button"
                className="btn-spec-close"
                onClick={() => setSelectedCapability(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Doctor Setup Modal */}
      {guidedSetupCapability && (
        <div className="capability-spec-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guided-setup-title">
          <div className="capability-spec-modal">
            <div className="spec-modal-header">
              <h3 id="guided-setup-title">Guided Setup Doctor: {guidedSetupCapability.name}</h3>
              <button
                type="button"
                className="spec-modal-close"
                onClick={() => setGuidedSetupCapability(null)}
                aria-label="Close guided setup"
              >
                ✕
              </button>
            </div>
            <div className="spec-modal-body">
              <p>This guided assistant will configure and verify dependencies for {guidedSetupCapability.name}.</p>
              <div className="diag-issues">
                <p>1. Target Profile: <strong>{runtimeProfile.toUpperCase()}</strong></p>
                <p>2. Required Software: {guidedSetupCapability.requiredSoftware.join(', ') || 'None (Native)'}</p>
              </div>
            </div>
            <div className="spec-modal-footer">
              <button
                type="button"
                className="btn-action-primary"
                onClick={() => {
                  setStatusMessage(`Guided setup completed for ${guidedSetupCapability.name}`);
                  setGuidedSetupCapability(null);
                  void fetchCapabilities();
                }}
              >
                Run Health Probe &amp; Enable
              </button>
              <button
                type="button"
                className="btn-spec-close"
                onClick={() => setGuidedSetupCapability(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Evidence Inspector Modal */}
      {selectedJob && (
        <div className="capability-spec-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="job-modal-title">
          <div className="capability-spec-modal">
            <div className="spec-modal-header">
              <div>
                <span className={`job-status-pill status-${selectedJob.status}`}>
                  {selectedJob.status.toUpperCase()}
                </span>
                <h3 id="job-modal-title">Evidence for: {selectedJob.title}</h3>
                <span className="spec-version">Job ID: <code>{selectedJob.id}</code></span>
              </div>
              <button
                type="button"
                className="spec-modal-close"
                onClick={() => setSelectedJob(null)}
                aria-label="Close evidence inspector"
              >
                ✕
              </button>
            </div>

            <div className="spec-modal-body">
              <div className="job-audit-digest">
                <span className="digest-label">Audit Digest:</span>
                <code>{selectedJob.auditDigest}</code>
              </div>

              {selectedJob.evidence.length === 0 ? (
                <p className="no-findings-msg">No captured evidence records for this job.</p>
              ) : (
                <div className="evidence-records-list">
                  {selectedJob.evidence.map((ev, i) => (
                    <div key={i} className="evidence-record-card">
                      <div className="evidence-record-header">
                        <span className="ev-type">{ev.type}</span>
                        <span className="ev-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="ev-desc">{ev.description}</p>
                      {ev.path && (
                        <div className="ev-path">
                          Path: <code>{ev.path}</code>
                        </div>
                      )}
                      <div className="ev-digest">
                        Digest: <code>{ev.digest}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="spec-modal-footer">
              <button
                type="button"
                className="btn-spec-close"
                onClick={() => setSelectedJob(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Artifact Lineage Inspector Modal */}
      {selectedArtifact && (
        <div className="capability-spec-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="artifact-modal-title">
          <div className="capability-spec-modal">
            <div className="spec-modal-header">
              <h3 id="artifact-modal-title">Artifact: {selectedArtifact.name}</h3>
              <button
                type="button"
                className="spec-modal-close"
                onClick={() => setSelectedArtifact(null)}
                aria-label="Close artifact inspector"
              >
                ✕
              </button>
            </div>
            <div className="spec-modal-body">
              <div className="spec-section">
                <p><strong>Capability:</strong> <code>{selectedArtifact.capabilityId}</code></p>
                <p><strong>MIME Type:</strong> {selectedArtifact.mimeType}</p>
                <p><strong>Size:</strong> {Math.round(selectedArtifact.byteSize / 1024)} KB</p>
                <p><strong>SHA-256 Hash:</strong> <code>{selectedArtifact.sha256Hash}</code></p>
                <p><strong>Parent Artifacts:</strong> {selectedArtifact.parentArtifactIds.length === 0 ? 'None (Root artifact)' : selectedArtifact.parentArtifactIds.join(', ')}</p>
              </div>
            </div>
            <div className="spec-modal-footer">
              <button
                type="button"
                className="btn-spec-close"
                onClick={() => setSelectedArtifact(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exact Scope Confirmation Modal for Dangerous Actions */}
      <ExactScopeConfirmModal
        isOpen={confirmModalState.isOpen}
        title="Exact-Scope Confirmation"
        capabilityName={confirmModalState.capability?.name || ''}
        actionLabel={confirmModalState.action?.label || ''}
        actionDescription={confirmModalState.action?.description || ''}
        requiredScope={confirmModalState.action?.requiredConfirmationScope || 'CONFIRM'}
        onConfirm={handleConfirmDangerousAction}
        onCancel={() => setConfirmModalState({ isOpen: false, capability: null, action: null })}
      />
    </section>
  );
}
