import { useEffect, useState } from 'react';
import { approveLocalRun, listLocalRuns, LocalRunSummary } from '../api/localRunApprovals';

interface LocalRunApprovalPanelProps {
  visible?: boolean;
}

export default function LocalRunApprovalPanel({ visible = true }: LocalRunApprovalPanelProps) {
  const [runs, setRuns] = useState<LocalRunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvalNote, setApprovalNote] = useState('Approved from local UI after reviewing command, cwd, and risk.');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listLocalRuns(25);
      setRuns(response.runs);
    } catch (err: any) {
      setError(err.message || 'Unable to load local runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) void refresh();
  }, [visible]);

  const approve = async (runId: string) => {
    try {
      setError('');
      await approveLocalRun(runId, approvalNote);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to approve local run');
    }
  };

  if (!visible) return null;

  return (
    <section className="assistant-panel local-run-approval-panel" aria-label="Local run approvals">
      <div className="assistant-panel-header">
        <div>
          <h3>Local Run Approval</h3>
          <p>Review planned local tool actions before they are allowed to run.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <label className="assistant-field">
        Approval note
        <input
          value={approvalNote}
          onChange={event => setApprovalNote(event.target.value)}
          placeholder="Why this run is approved"
        />
      </label>

      {error && <div className="assistant-error-bar" role="alert">{error}</div>}

      <div className="local-run-list">
        {runs.length === 0 && <p className="assistant-muted">No local runs have been planned yet.</p>}
        {runs.map(run => (
          <article key={run.id} className="local-run-card">
            <div className="local-run-card-header">
              <strong>{run.status}</strong>
              <span className={`risk-pill risk-${run.riskLevel}`}>{run.riskLevel}</span>
              {run.approvedByUser && <span className="approval-pill">Approved</span>}
            </div>
            <code>{run.commandTemplate}</code>
            <p><strong>CWD:</strong> {run.cwd}</p>
            {(run.stdoutPath || run.stderrPath) && (
              <p className="assistant-muted">
                Output: {run.stdoutPath || 'no stdout'} / {run.stderrPath || 'no stderr'}
              </p>
            )}
            <button
              type="button"
              onClick={() => approve(run.id)}
              disabled={run.approvedByUser || run.status !== 'planned'}
            >
              Approve planned run
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
