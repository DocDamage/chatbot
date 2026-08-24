import { useState, useEffect, useCallback } from 'react';
import { isStaticPagesBuild } from '../api/runtime';

export interface EvaluationSummary {
  id: string;
  timestamp: string;
  status: 'passed' | 'failed' | 'degraded';
  overallScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  sha256Digest: string;
  domainSummaries: Record<string, { total: number; passed: number; failed: number; averageScore: number }>;
}

export interface SLOMetric {
  id: string;
  name: string;
  targetPercent: number;
  currentPercent: number;
  errorBudgetRemaining: number;
  status: 'healthy' | 'at_risk' | 'breached';
  escalationOwner: string;
  rollbackTriggerThreshold: number;
}

export interface DashboardSummary {
  timestamp: string;
  hasTelemetry: boolean;
  totalInvocations: number;
  successRate: number;
  latencyPercentiles: { p50: number; p95: number; p99: number };
  totalEstimatedCostUsd: number;
  slos: SLOMetric[];
  activeRollbackTriggers: Array<{ capabilityId: string; reason: string; triggeredAt: string }>;
  recentAlerts: Array<{ id: string; severity: string; message: string; owner: string }>;
}

interface PromotionCapability { id: string; name: string; maturity: string }
interface PromotionEvaluation {
  isEligible: boolean;
  blockers: string[];
  gateCriteria: Array<{ id: string; name: string; passed: boolean; evidence: string }>;
}
interface PromotionDecision {
  recordId: string;
  timestamp: string;
  capabilityId: string;
  previousMaturity: string;
  newMaturity: string;
  promotedBy: string;
  rationale: string;
  sha256Digest: string;
}

export default function CapabilityPromotionView() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluationSummary | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState<string | null>(null);
  const [supportBundleDigest, setSupportBundleDigest] = useState<string | null>(null);
  const [isExportingBundle, setIsExportingBundle] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [promotionCapabilities, setPromotionCapabilities] = useState<PromotionCapability[]>([]);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState('');
  const [targetMaturity, setTargetMaturity] = useState('PRODUCTION_PREVIEW');
  const [rationale, setRationale] = useState('');
  const [typedPromotionScope, setTypedPromotionScope] = useState('');
  const [promotionEvaluation, setPromotionEvaluation] = useState<PromotionEvaluation | null>(null);
  const [promotionDecisions, setPromotionDecisions] = useState<PromotionDecision[]>([]);
  const [promotionFeedback, setPromotionFeedback] = useState<string | null>(null);
  const [isEvaluatingPromotion, setIsEvaluatingPromotion] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('jwt');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (isStaticPagesBuild) return;
    try {
      const res = await fetch('/api/capabilities/metrics/dashboard', {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error(`Metrics request failed with HTTP ${res.status}`);
      const data = await res.json();
      setDashboard(data.dashboard);
      setDashboardError(null);
    } catch (error: any) {
      setDashboard(null);
      setDashboardError(error.message || 'Metrics dashboard is unavailable.');
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (isStaticPagesBuild) return;
    void Promise.all([
      fetch('/api/capabilities', { headers: getAuthHeaders() }).then(async response => {
        if (!response.ok) throw new Error(`Capabilities request failed with HTTP ${response.status}`);
        const data = await response.json();
        const items = (data.capabilities || []).map((item: any) => ({ id: item.id, name: item.name, maturity: item.maturity }));
        setPromotionCapabilities(items);
        setSelectedCapabilityId((current: string) => current || items[0]?.id || '');
      }),
      fetch('/api/capabilities/promotions/decisions', { headers: getAuthHeaders() }).then(async response => {
        if (!response.ok) throw new Error(`Decision records request failed with HTTP ${response.status}`);
        const data = await response.json();
        setPromotionDecisions(data.decisions || []);
      })
    ]).catch((error: any) => setPromotionFeedback(`Promotion governance data unavailable: ${error.message}`));
  }, [getAuthHeaders]);

  const requiredPromotionScope = selectedCapabilityId
    ? `PROMOTE_CAPABILITY:${selectedCapabilityId}:${targetMaturity}`
    : '';

  const handleEvaluatePromotion = async () => {
    if (!selectedCapabilityId) return;
    setIsEvaluatingPromotion(true);
    setPromotionFeedback('Evaluating objective promotion gates…');
    try {
      const response = await fetch('/api/capabilities/promotions/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ capabilityId: selectedCapabilityId, targetMaturity })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setPromotionEvaluation(data.evaluation);
      setPromotionFeedback(data.evaluation.isEligible ? 'All evaluated promotion gates passed.' : 'Promotion is blocked; review the gate evidence below.');
    } catch (error: any) {
      setPromotionEvaluation(null);
      setPromotionFeedback(`Promotion evaluation failed: ${error.message}`);
    } finally {
      setIsEvaluatingPromotion(false);
    }
  };

  const handlePromote = async () => {
    setIsPromoting(true);
    try {
      const response = await fetch('/api/capabilities/promotions/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          capabilityId: selectedCapabilityId,
          targetMaturity,
          rationale,
          confirmedScope: typedPromotionScope
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setPromotionDecisions(current => [...current, data.decisionRecord]);
      setPromotionFeedback(data.message);
      setPromotionEvaluation(null);
      setTypedPromotionScope('');
    } catch (error: any) {
      setPromotionFeedback(`Promotion failed: ${error.message}`);
    } finally {
      setIsPromoting(false);
    }
  };

  const handleRunEvaluation = async () => {
    setIsRunningEval(true);
    setEvalFeedback('Running cross-capability evaluation suite across all 10 domain vectors...');
    try {
      const res = await fetch('/api/capabilities/evaluations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        setEvalResult(data.result);
        setEvalFeedback(`Evaluation complete: ${data.result.passedChecks}/${data.result.totalChecks} checks passed (${(data.result.overallScore * 100).toFixed(1)}%).`);
      } else {
        setEvalFeedback('Failed to execute evaluation suite.');
      }
    } catch (err: any) {
      setEvalFeedback(`Evaluation error: ${err.message}`);
    } finally {
      setIsRunningEval(false);
    }
  };

  const handleExportSupportBundle = async () => {
    setIsExportingBundle(true);
    try {
      const res = await fetch('/api/capabilities/support-bundle', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSupportBundleDigest(data.bundle.sha256Digest);
        const blob = new Blob([JSON.stringify(data.bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `support-bundle-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setEvalFeedback('Failed to export diagnostic bundle.');
    } finally {
      setIsExportingBundle(false);
    }
  };

  return (
    <div className="capability-promotion-view" role="region" aria-label="Capability Evaluation and Promotion Dashboard">
      <div className="eval-header-banner">
        <div>
          <h2>Evaluation & Promotion Governance (CF-10)</h2>
          <p className="subtitle">
            Objective verification gates, privacy-preserving SLO metrics, and cryptographic promotion records across all 3 maturity stages.
          </p>
        </div>
        <div className="eval-actions-group">
          <button
            className="btn btn-primary"
            onClick={handleRunEvaluation}
            disabled={isRunningEval}
            aria-busy={isRunningEval}
          >
            {isRunningEval ? 'Running Evaluation...' : 'Run Evaluation Suite'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleExportSupportBundle}
            disabled={isExportingBundle}
          >
            {isExportingBundle ? 'Exporting...' : 'Export Support Bundle'}
          </button>
        </div>
      </div>

      {evalFeedback && (
        <div className="eval-status-callout" role="status" aria-live="polite">
          {evalFeedback}
        </div>
      )}

      {supportBundleDigest && (
        <div className="digest-callout">
          <strong>Support Bundle SHA-256 Digest:</strong>
          <code>{supportBundleDigest}</code>
        </div>
      )}

      <div className="promotion-control-panel">
        <h3>Evaluate and Record a Promotion Decision</h3>
        <p>Promotion advances exactly one maturity stage and remains blocked until every required evidence gate passes.</p>
        <div className="promotion-form-grid">
          <label>Capability
            <select value={selectedCapabilityId} onChange={event => { setSelectedCapabilityId(event.target.value); setPromotionEvaluation(null); setTypedPromotionScope(''); }}>
              {promotionCapabilities.map(item => <option key={item.id} value={item.id}>{item.name} — {item.maturity}</option>)}
            </select>
          </label>
          <label>Target maturity
            <select value={targetMaturity} onChange={event => { setTargetMaturity(event.target.value); setPromotionEvaluation(null); setTypedPromotionScope(''); }}>
              <option value="LOCAL_ONLY_EXPERIMENTAL">LOCAL_ONLY_EXPERIMENTAL</option>
              <option value="PRODUCTION_PREVIEW">PRODUCTION_PREVIEW</option>
              <option value="PRODUCTION_SUPPORTED">PRODUCTION_SUPPORTED</option>
            </select>
          </label>
          <label>Decision rationale
            <textarea value={rationale} onChange={event => setRationale(event.target.value)} rows={3} />
          </label>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleEvaluatePromotion} disabled={!selectedCapabilityId || isEvaluatingPromotion}>
          {isEvaluatingPromotion ? 'Evaluating…' : 'Evaluate Promotion Gates'}
        </button>
        {promotionEvaluation && (
          <div className="promotion-gate-results" aria-live="polite">
            <ul>
              {promotionEvaluation.gateCriteria.map(gate => <li key={gate.id}><strong>{gate.passed ? 'PASS' : 'BLOCK'} — {gate.name}:</strong> {gate.evidence}</li>)}
            </ul>
            {promotionEvaluation.blockers.length > 0 && <p role="alert">{promotionEvaluation.blockers.join(' ')}</p>}
          </div>
        )}
        {promotionEvaluation?.isEligible && (
          <div className="promotion-exact-scope">
            <label>Type <code>{requiredPromotionScope}</code> to authorize this maturity change
              <input value={typedPromotionScope} onChange={event => setTypedPromotionScope(event.target.value)} autoComplete="off" />
            </label>
            <button type="button" className="btn btn-primary" onClick={handlePromote} disabled={isPromoting || !rationale.trim() || typedPromotionScope !== requiredPromotionScope}>
              {isPromoting ? 'Recording Promotion…' : 'Promote and Record Decision'}
            </button>
          </div>
        )}
        {promotionFeedback && <div className="eval-status-callout" role="status" aria-live="polite">{promotionFeedback}</div>}
      </div>

      {/* SLOs & Observability Metrics */}
      <div className="slo-section">
        <h3>Service Level Objectives (SLOs) & Error Budgets</h3>
        {dashboardError && <div className="eval-status-callout" role="alert">Live metrics unavailable: {dashboardError}</div>}
        {!dashboard && !dashboardError && <p role="status">Loading live metrics…</p>}
        {dashboard && !dashboard.hasTelemetry && <div className="eval-status-callout" role="status">No capability telemetry has been recorded in this server session; configured SLO targets are shown without claiming measured compliance.</div>}
        <div className="slo-grid">
          {dashboard?.slos.map(slo => (
            <div key={slo.id} className={`slo-card slo-${slo.status}`}>
              <div className="slo-header">
                <span className="slo-name">{slo.name}</span>
                <span className={`badge badge-${slo.status}`}>{slo.status.toUpperCase()}</span>
              </div>
              <div className="slo-metrics">
                <div className="metric-row">
                  <span>Current Compliance:</span>
                  <strong>{slo.currentPercent}%</strong>
                </div>
                <div className="metric-row">
                  <span>Target SLO:</span>
                  <span>{slo.targetPercent}%</span>
                </div>
                <div className="metric-row">
                  <span>Error Budget Remaining:</span>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      role="progressbar"
                      aria-label={`${slo.name} error budget remaining`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={slo.errorBudgetRemaining}
                      style={{ width: `${Math.min(100, Math.max(0, slo.errorBudgetRemaining))}%` }}
                    />
                  </div>
                  <span>{slo.errorBudgetRemaining}%</span>
                </div>
                <div className="metric-row owner-row">
                  <span>Escalation Owner:</span>
                  <code>{slo.escalationOwner}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Results Breakdown */}
      {evalResult && (
        <div className="eval-results-breakdown">
          <h3>Latest Evaluation Run: <code>{evalResult.id}</code></h3>
          <div className="digest-callout">
            <strong>Result SHA-256 Digest:</strong> <code>{evalResult.sha256Digest}</code>
          </div>
          <table className="eval-table" aria-label="Evaluation Domain Summary Table">
            <thead>
              <tr>
                <th scope="col">Domain Vector</th>
                <th scope="col">Checks Passed</th>
                <th scope="col">Score</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(evalResult.domainSummaries).map(([domain, sum]) => (
                <tr key={domain}>
                  <td><strong>{domain.replace(/_/g, ' ')}</strong></td>
                  <td>{sum.passed} / {sum.total}</td>
                  <td>{(sum.averageScore * 100).toFixed(1)}%</td>
                  <td>
                    <span className={`badge ${sum.failed === 0 ? 'badge-healthy' : 'badge-degraded'}`}>
                      {sum.failed === 0 ? 'PASSED' : 'FAILED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Promotion Lifecycle Rules Guide */}
      <div className="promotion-rules-guide">
        <h3>Promotion Gate Lifecycle (ADR-0020)</h3>
        <div className="lifecycle-stages-grid">
          <div className="stage-card">
            <span className="stage-number">Stage 1</span>
            <h4>Disabled &rarr; Local Experimental</h4>
            <p>Requires focused unit & integration tests, ApprovedRepositoryGateway containment, and a documented local canary.</p>
          </div>
          <div className="stage-card">
            <span className="stage-number">Stage 2</span>
            <h4>Local Experimental &rarr; Production Preview</h4>
            <p>Requires full accessible UI, documentation, benchmark score &ge; 90%, error recovery, and cross-platform tests.</p>
          </div>
          <div className="stage-card">
            <span className="stage-number">Stage 3</span>
            <h4>Production Preview &rarr; Production Supported</h4>
            <p>Requires full production verification gate pass (Phases 3-12), signed ADR, and release candidate commit certification.</p>
          </div>
        </div>
      </div>

      <div className="promotion-rules-guide">
        <h3>Immutable Promotion and Rollback Records</h3>
        {promotionDecisions.length === 0 ? <p>No decisions have been recorded in this server session.</p> : (
          <table className="eval-table" aria-label="Promotion and rollback decision records">
            <thead><tr><th>Capability</th><th>Change</th><th>Operator</th><th>Digest</th></tr></thead>
            <tbody>{promotionDecisions.map(record => (
              <tr key={record.recordId}>
                <td>{record.capabilityId}</td><td>{record.previousMaturity} → {record.newMaturity}</td>
                <td>{record.promotedBy}</td><td><code>{record.sha256Digest}</code></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
