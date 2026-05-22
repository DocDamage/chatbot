import { useEffect, useState } from 'react';
import {
  approveLocalRun,
  cancelLocalRun,
  listLocalRunFiles,
  listLocalRuns,
  localRunFileUrl,
  LocalRunOutputFile,
  LocalRunSummary,
  readLocalRunFile,
  startLocalRun
} from '../api/localRunApprovals';

interface LocalRunApprovalPanelProps {
  visible?: boolean;
}

type OutputTab = 'stdout.txt' | 'stderr.txt';

const terminalStatuses = new Set(['completed', 'failed', 'timed_out', 'cancelled']);

export default function LocalRunApprovalPanel({ visible = true }: LocalRunApprovalPanelProps) {
  const [runs, setRuns] = useState<LocalRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [outputFiles, setOutputFiles] = useState<LocalRunOutputFile[]>([]);
  const [outputText, setOutputText] = useState('');
  const [activeTab, setActiveTab] = useState<OutputTab>('stdout.txt');
  const [loading, setLoading] = useState(false);
  const [outputLoading, setOutputLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvalNote, setApprovalNote] = useState('Approved from local UI after reviewing command, cwd, and risk.');

  const refresh = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await listLocalRuns(25);
      setRuns(response.runs);
      if (!selectedRunId && response.runs[0]) setSelectedRunId(response.runs[0].id);
    } catch (err: any) {
      setError(friendlyLocalToolError(err, 'Unable to load local runs'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) void refresh();
  }, [visible]);

  useEffect(() => {
    if (selectedRunId) void loadOutputFiles(selectedRunId, activeTab);
  }, [selectedRunId]);

  const approve = async (runId: string) => {
    try {
      setError('');
      await approveLocalRun(runId, approvalNote);
      await refresh();
    } catch (err: any) {
      setError(friendlyLocalToolError(err, 'Unable to approve local run'));
    }
  };

  const start = async (runId: string) => {
    try {
      setError('');
      await startLocalRun(runId);
      await refresh();
      setSelectedRunId(runId);
      await loadOutputFiles(runId, activeTab);
    } catch (err: any) {
      setError(friendlyLocalToolError(err, 'Unable to start local run'));
    }
  };

  const cancel = async (runId: string) => {
    try {
      setError('');
      await cancelLocalRun(runId);
      await refresh();
    } catch (err: any) {
      setError(friendlyLocalToolError(err, 'Unable to cancel local run'));
    }
  };

  const loadOutputFiles = async (runId: string, tab: OutputTab) => {
    try {
      setOutputLoading(true);
      setError('');
      const response = await listLocalRunFiles(runId);
      setOutputFiles(response.files);
      const hasTab = response.files.some(file => file.fileName === tab);
      const nextTab = hasTab ? tab : response.files.some(file => file.fileName === 'stderr.txt') ? 'stderr.txt' : 'stdout.txt';
      setActiveTab(nextTab);
      if (response.files.some(file => file.fileName === nextTab)) {
        setOutputText(await readLocalRunFile(runId, nextTab));
      } else {
        setOutputText('No output files have been captured yet.');
      }
    } catch (err: any) {
      setOutputFiles([]);
      setOutputText('No output files are available for this run yet.');
    } finally {
      setOutputLoading(false);
    }
  };

  const switchOutputTab = async (tab: OutputTab) => {
    if (!selectedRunId) return;
    setActiveTab(tab);
    try {
      setOutputLoading(true);
      setOutputText(await readLocalRunFile(selectedRunId, tab));
    } catch {
      setOutputText(`No ${tab.replace('.txt', '')} output is available for this run.`);
    } finally {
      setOutputLoading(false);
    }
  };

  const copy = async (value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard?.writeText(value);
  };

  if (!visible) return null;

  const selectedRun = runs.find(run => run.id === selectedRunId) || runs[0];

  return (
    <section className="assistant-panel local-run-approval-panel" aria-label="Local run approvals">
      <div className="assistant-panel-header">
        <div>
          <h3>Local Run Approval</h3>
          <p>Approve, start, cancel, and inspect local tool runs from one auditable workspace.</p>
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

      <div className="local-run-layout">
        <div className="local-run-list">
          {runs.length === 0 && <p className="assistant-muted">No local runs have been planned yet.</p>}
          {runs.map(run => {
            const canApprove = run.status === 'planned' || run.status === 'failed';
            const canStart = run.approvedByUser && (run.status === 'planned' || run.status === 'failed');
            const canCancel = run.status === 'running' || run.status === 'processing' || run.status === 'cancel_requested';
            const isSelected = selectedRun?.id === run.id;

            return (
              <article key={run.id} className={`local-run-card ${isSelected ? 'selected' : ''}`}>
                <button type="button" className="local-run-select" onClick={() => setSelectedRunId(run.id)}>
                  Select
                </button>
                <div className="local-run-card-header">
                  <span className={`status-pill status-${statusClass(run.status)}`}>{run.status}</span>
                  <span className={`risk-pill risk-${run.riskLevel}`}>{run.riskLevel}</span>
                  {run.approvedByUser && <span className="approval-pill">Approved</span>}
                  {run.executableEnabled === false && <span className="disabled-pill">Executable disabled</span>}
                </div>
                <code>{run.commandTemplate}</code>
                <p><strong>CWD:</strong> {run.cwd}</p>
                {run.executablePath && <p><strong>Executable:</strong> {run.executablePath}</p>}
                {run.durationMs !== undefined && <p><strong>Duration:</strong> {run.durationMs}ms</p>}
                <div className="local-run-actions">
                  <button type="button" onClick={() => approve(run.id)} disabled={!canApprove || run.approvedByUser}>
                    Approve
                  </button>
                  <button type="button" onClick={() => start(run.id)} disabled={!canStart}>
                    Start
                  </button>
                  <button type="button" onClick={() => cancel(run.id)} disabled={!canCancel}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => copy(run.commandTemplate)}>
                    Copy command
                  </button>
                  <button type="button" onClick={() => copy(run.stdoutPath || run.stderrPath || '')} disabled={!run.stdoutPath && !run.stderrPath}>
                    Copy output path
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="local-run-output-browser">
          <div className="local-run-output-header">
            <strong>Output browser</strong>
            {selectedRun && <span>{selectedRun.id}</span>}
          </div>
          {selectedRun ? (
            <>
              <div className="local-run-output-tabs">
                <button type="button" className={activeTab === 'stdout.txt' ? 'active' : ''} onClick={() => switchOutputTab('stdout.txt')}>stdout</button>
                <button type="button" className={activeTab === 'stderr.txt' ? 'active' : ''} onClick={() => switchOutputTab('stderr.txt')}>stderr</button>
                <button type="button" onClick={() => loadOutputFiles(selectedRun.id, activeTab)}>Reload output</button>
              </div>
              <div className="local-run-output-links">
                {outputFiles.length === 0 && <span className="assistant-muted">No output files yet.</span>}
                {outputFiles.map(file => (
                  <a key={file.fileName} href={localRunFileUrl(selectedRun.id, file.fileName)} target="_blank" rel="noreferrer">
                    {file.fileName} · {formatBytes(file.size)}
                  </a>
                ))}
              </div>
              <pre className="local-run-output-text">{outputLoading ? 'Loading output…' : outputText}</pre>
            </>
          ) : (
            <p className="assistant-muted">Select a run to inspect stdout, stderr, and generated files.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function statusClass(status: string): string {
  if (terminalStatuses.has(status)) return status.replace(/_/g, '-');
  if (status.includes('cancel')) return 'cancel-requested';
  return status.replace(/_/g, '-');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function friendlyLocalToolError(error: any, fallback: string): string {
  const message = error?.message || fallback;
  if (/requires explicit user approval/i.test(message)) {
    return 'This run needs approval before it can start. Review the command, approve it, then press Start.';
  }
  if (/not enabled|disabled/i.test(message)) {
    return 'The selected executable is disabled. Enable or re-register the tool before starting this run.';
  }
  if (/outside workspace|path/i.test(message)) {
    return 'That path is blocked because it resolves outside the trusted workspace.';
  }
  if (/not found/i.test(message)) {
    return 'The run or output file was not found. Refresh the local run list and try again.';
  }
  return message;
}
