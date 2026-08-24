import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CapabilityHubPanel from './CapabilityHubPanel';

vi.mock('../api/runtime', () => ({ isStaticPagesBuild: false }));

const mockCapabilities = [
  {
    id: 'repo_architecture',
    name: 'Architecture Graph (CF-01)',
    shortDescription: 'Symbol graph and call hierarchy',
    detailedDescription: 'Constructs syntax and dependency graph',
    category: 'coding',
    section: 'available_now',
    maturity: 'LOCAL_ONLY_EXPERIMENTAL',
    processingLocation: 'local',
    provider: 'Internal AST Engine',
    requiredSoftware: ['Node.js runtime'],
    authorityAndEgress: {
      filesystemAuthority: 'Read-only bounded (128KB max)',
      networkEgress: 'Zero network egress',
      processAuthority: 'None',
      approvalGateRequired: false
    },
    healthState: 'healthy',
    version: '1.0.0-cf01',
    estimatedCostAndResources: {
      computeImpact: 'Low (CPU only)',
      estimatedLatency: '< 100ms',
      costProfile: 'Free / Local Compute'
    },
    dataRetentionPolicy: 'Ephemeral in-memory cache',
    supportStatusAndLimitations: ['Bounded to 3,000 files'],
    actions: [
      { id: 'test_run', label: 'Run Graph Diagnostic', description: 'Validate symbol resolution' }
    ],
    localOnly: true
  },
  {
    id: 'typed_agent_teams',
    name: 'Typed Agent Teams (CF-05)',
    shortDescription: 'Parallel agents in worktrees',
    detailedDescription: 'Coordinates specialized agent teams',
    category: 'agents',
    section: 'available_now',
    maturity: 'LOCAL_ONLY_EXPERIMENTAL',
    processingLocation: 'local',
    provider: 'AgentTeamCoordinator',
    requiredSoftware: ['Git CLI'],
    authorityAndEgress: {
      filesystemAuthority: 'Isolated worktree checkout only',
      networkEgress: 'Zero egress',
      processAuthority: 'Bounded child processes',
      approvalGateRequired: true
    },
    healthState: 'healthy',
    version: '1.0.0-cf05',
    estimatedCostAndResources: {
      computeImpact: 'Medium (~4GB VRAM/RAM)',
      estimatedLatency: 'Variable',
      costProfile: 'Free / Local Compute'
    },
    dataRetentionPolicy: 'Ephemeral worktrees',
    supportStatusAndLimitations: ['Single-agent fallback available'],
    actions: [
      {
        id: 'disable_capability',
        label: 'Disable Multi-Agent Teams',
        description: 'Force single agent execution mode',
        isDangerous: true,
        requiredConfirmationScope: 'DISABLE_AGENT_TEAMS'
      }
    ],
    localOnly: true
  },
  {
    id: 'local_model_adapter',
    name: 'Local Model Adapter (CF-04)',
    shortDescription: 'Consume external local LLMs',
    detailedDescription: 'Connects to Ollama / vLLM',
    category: 'core',
    section: 'needs_setup',
    maturity: 'LOCAL_ONLY_EXPERIMENTAL',
    processingLocation: 'local',
    provider: 'Ollama',
    requiredSoftware: ['Ollama'],
    authorityAndEgress: {
      filesystemAuthority: 'None',
      networkEgress: 'Loopback 127.0.0.1 only',
      processAuthority: 'None',
      approvalGateRequired: false
    },
    healthState: 'not_configured',
    version: '1.0.0-cf04',
    estimatedCostAndResources: {
      computeImpact: 'Medium (~4GB VRAM/RAM)',
      estimatedLatency: '500ms',
      costProfile: 'Free / Local Compute'
    },
    dataRetentionPolicy: 'Local loopback',
    supportStatusAndLimitations: ['SSRF protection active'],
    diagnostics: {
      isBlocked: true,
      issues: ['Local model adapter is disabled in configuration.'],
      remediationSteps: ['Set LOCAL_MODEL_ENABLED=true in .env file.']
    },
    actions: [
      { id: 'run_canary', label: 'Probe Local Model', description: 'Probe endpoint health' }
    ],
    localOnly: true
  }
];

const mockJobs = [
  {
    id: 'job-12345',
    capabilityId: 'repo_architecture',
    category: 'coding',
    title: 'Diagnostic test for Architecture Graph',
    requester: 'Operator',
    status: 'completed',
    startedAt: '2026-08-24T12:00:00.000Z',
    completedAt: '2026-08-24T12:00:01.000Z',
    progressPercent: 100,
    evidence: [
      {
        type: 'diagnostic_canary',
        description: 'Canary execution completed',
        digest: 'sha256-abc123evidence',
        timestamp: '2026-08-24T12:00:01.000Z'
      }
    ],
    auditDigest: 'sha256-auditdigest123'
  },
  {
    id: 'job-67890',
    capabilityId: 'browser_jobs',
    category: 'browser',
    title: 'Browser QA job',
    requester: 'Operator',
    status: 'running',
    startedAt: '2026-08-24T12:05:00.000Z',
    progressPercent: 40,
    evidence: [],
    auditDigest: 'sha256-auditdigest678'
  }
];

describe('CapabilityHubPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn((url: string, _init?: RequestInit) => {
      if (url === '/api/capabilities') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profile: 'local', capabilities: mockCapabilities })
        });
      }
      if (url === '/api/capabilities/jobs/list') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobs: mockJobs })
        });
      }
      if (url === '/api/capabilities/repository-findings') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            overlays: [
              { path: 'src/server/index.ts', hotspot: 3, testGap: false, trustBoundary: true, findingIds: ['f-1'] },
              { path: 'src/core/security/ApprovedRepositoryGateway.ts', hotspot: 2, testGap: false, trustBoundary: true, findingIds: ['f-2'] }
            ],
            findings: []
          })
        });
      }
      if (url.includes('/action')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, message: 'Action executed successfully.' })
        });
      }
      if (url.includes('/cancel')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders Capability Hub title, profile, and capability cards', async () => {
    render(<CapabilityHubPanel />);

    expect(screen.getByRole('heading', { name: 'Unified Capability Hub' })).toBeTruthy();
    expect(screen.getByText('Profile: LOCAL')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Architecture Graph (CF-01)')).toBeTruthy();
      expect(screen.getByText('Typed Agent Teams (CF-05)')).toBeTruthy();
      expect(screen.getByText('Local Model Adapter (CF-04)')).toBeTruthy();
    });
  });

  it('filters capabilities when clicking section buttons', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await waitFor(() => {
      expect(screen.getByText('Architecture Graph (CF-01)')).toBeTruthy();
    });

    // Click Needs Setup filter
    await user.click(screen.getByRole('radio', { name: 'Needs Setup' }));
    expect(screen.getByText('Local Model Adapter (CF-04)')).toBeTruthy();
    expect(screen.queryByText('Architecture Graph (CF-01)')).toBeNull();

    // Reset to All
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(screen.getByText('Architecture Graph (CF-01)')).toBeTruthy();
  });

  it('opens specification modal and displays diagnostics', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await waitFor(() => {
      expect(screen.getByText('Local Model Adapter (CF-04)')).toBeTruthy();
    });

    const inspectButtons = screen.getAllByRole('button', { name: /Inspect full specifications/i });
    await user.click(inspectButtons[2]); // Local Model Adapter

    expect(screen.getByText('Diagnostics & Actionable Remediation')).toBeTruthy();
    expect(screen.getByText('Local model adapter is disabled in configuration.')).toBeTruthy();
    expect(screen.getByText('Set LOCAL_MODEL_ENABLED=true in .env file.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Diagnostics & Actionable Remediation')).toBeNull();
  });

  it('requires exact-scope confirmation for dangerous actions', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Disable Multi-Agent Teams' })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Disable Multi-Agent Teams' }));

    expect(screen.getByRole('heading', { name: 'Exact-Scope Confirmation' })).toBeTruthy();
    expect(screen.getByText('DISABLE_AGENT_TEAMS')).toBeTruthy();

    const confirmBtn = screen.getByRole('button', { name: 'Confirm & Execute' });
    expect(confirmBtn.hasAttribute('disabled')).toBe(true);

    const input = screen.getByLabelText('Type confirmation phrase:');
    await user.type(input, 'DISABLE_AGENT_TEAMS');

    expect(confirmBtn.hasAttribute('disabled')).toBe(false);
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Exact-Scope Confirmation' })).toBeNull();
    });
  });

  it('renders the Jobs & Audit tab with job cards and cancellation', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await user.click(screen.getByRole('button', { name: /Jobs & Audit/i }));

    await waitFor(() => {
      expect(screen.getByText('Diagnostic test for Architecture Graph')).toBeTruthy();
      expect(screen.getByText('Browser QA job')).toBeTruthy();
      expect(screen.getByText('sha256-auditdigest123')).toBeTruthy();
    });

    const cancelBtn = screen.getByRole('button', { name: 'Cancel Job' });
    await user.click(cancelBtn);
  });

  it('renders the 2D Findings Topology view with graph and table', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await waitFor(() => {
      expect(screen.getByText('Architecture Graph (CF-01)')).toBeTruthy();
    });

    const findingsTabBtn = screen.getByRole('button', { name: /2D Topology/i });
    await user.click(findingsTabBtn);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeTruthy();
      expect(screen.getAllByText('src/server/index.ts').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders Onboarding & Policy guide', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    await user.click(screen.getByRole('button', { name: 'Onboarding & Policy' }));

    expect(screen.getByText('Understanding ChatBot Runtime Boundaries')).toBeTruthy();
    expect(screen.getByText('Local vs Hosted Isolation')).toBeTruthy();
    expect(screen.getByText('Approval Gates & Exact Scope')).toBeTruthy();
  });

  it('renders the CF-10 Evaluation & Promotion tab', async () => {
    const user = userEvent.setup();
    render(<CapabilityHubPanel />);

    const evalTabBtn = screen.getByRole('button', { name: /Evaluation & Promotion/i });
    await user.click(evalTabBtn);

    expect(screen.getByRole('heading', { name: /Evaluation & Promotion Governance/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Run Evaluation Suite' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export Support Bundle' })).toBeTruthy();
  });
});
