import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CapabilityPromotionView from '../CapabilityPromotionView';

describe('RT-CAP-002: CapabilityPromotionView Workflow Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/capabilities/metrics/dashboard') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            dashboard: {
              timestamp: '2026-08-26T00:00:00Z',
              hasTelemetry: true,
              totalInvocations: 1200,
              successRate: 0.995,
              latencyPercentiles: { p50: 120, p95: 350, p99: 800 },
              totalEstimatedCostUsd: 1.45,
              slos: [
                {
                  id: 'slo-latency',
                  name: 'p95 Latency',
                  targetPercent: 99.0,
                  currentPercent: 99.5,
                  errorBudgetRemaining: 75.0,
                  status: 'healthy',
                  escalationOwner: 'platform-team',
                  rollbackTriggerThreshold: 90.0
                }
              ],
              activeRollbackTriggers: [],
              recentAlerts: []
            }
          })
        });
      }
      if (url === '/api/capabilities') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            capabilities: [
              { id: 'math', name: 'Math Genius', maturity: 'EXPERIMENTAL' },
              { id: 'gis', name: 'GIS Mapping', maturity: 'BETA' }
            ]
          })
        });
      }
      if (url === '/api/capabilities/promotions/decisions') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            decisions: [
              {
                recordId: 'rec-1',
                timestamp: '2026-08-25T12:00:00Z',
                capabilityId: 'math',
                previousMaturity: 'EXPERIMENTAL',
                newMaturity: 'PRODUCTION_PREVIEW',
                promotedBy: 'lead-engineer',
                rationale: 'Passed all unit and stress benchmarks',
                sha256Digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
              }
            ]
          })
        });
      }
      if (url === '/api/capabilities/promotions/evaluate') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            evaluation: {
              isEligible: true,
              blockers: [],
              gateCriteria: [
                { id: 'tests', name: 'Automated Test Coverage', passed: true, evidence: 'All tests pass' }
              ]
            }
          })
        });
      }
      if (url === '/api/capabilities/evaluations/run') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            evaluation: {
              id: 'eval-1',
              timestamp: '2026-08-26T00:00:00Z',
              status: 'passed',
              overallScore: 98.5,
              totalChecks: 50,
              passedChecks: 50,
              failedChecks: 0,
              sha256Digest: 'a1b2c3d4e5f6',
              domainSummaries: {}
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads dashboard telemetry, active SLOs, and promotion capabilities', async () => {
    render(<CapabilityPromotionView />);

    await waitFor(() => {
      expect(screen.getByText(/p95 Latency/i)).toBeTruthy();
      expect(screen.getByText(/Math Genius/i)).toBeTruthy();
    });
  });

  it('runs promotion gate evaluation when requested', async () => {
    render(<CapabilityPromotionView />);

    await waitFor(() => {
      expect(screen.getByText(/Math Genius/i)).toBeTruthy();
    });

    const evalBtn = screen.getByRole('button', { name: /evaluate promotion gates/i });
    fireEvent.click(evalBtn);

    await waitFor(() => {
      expect(screen.getByText(/Automated Test Coverage/i)).toBeTruthy();
    });
  });
});
