import { useEffect, useState } from 'react';
import { apiFetch } from '../api/http';
import './ReaPanel.css';

interface ReaStatus { available: boolean; enabled: boolean; installed: boolean; version?: string; allowedRoots: string[]; maxInputBytes: number }
interface Job {
  id: string; target: string; status: string; error?: string; evidenceSha256?: string;
  input?: { sha256?: string; limitations: string[] };
  steps?: { tool: string; evidenceId?: string; result: unknown }[];
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/rea${url}`, init);
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : data.error?.message || data.message || 'REA request failed.');
  return data;
}
const running = (job: Job | null) => job && ['queued', 'running'].includes(job.status);

export default function ReaPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ReaStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [target, setTarget] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState('auto');
  const [procedure, setProcedure] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    void Promise.all([request<ReaStatus>('/status'), request<{ jobs: Job[] }>('/jobs')])
      .then(([health, recent]) => { if (!disposed) { setStatus(health); setJobs(recent.jobs); } })
      .catch(failure => { if (!disposed) setError(failure.message); });
    return () => { disposed = true; };
  }, [open]);
  useEffect(() => {
    if (!open || !running(job)) return;
    const timer = window.setTimeout(() => {
      void request<Job>(`/jobs/${job!.id}`).then(setJob).catch(failure => setError(failure.message));
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [open, job]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      let next: Job;
      if (file) {
        if (status && file.size > status.maxInputBytes) throw new Error('Artifact exceeds the upload limit.');
        const data = new FormData(); data.append('artifact', file); data.append('operation', operation);
        if (operation === 'native' && procedure.trim()) data.append('procedure', procedure.trim());
        next = await request<Job>('/upload', { method: 'POST', body: data });
      } else next = await request<Job>('/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target, operation, procedure: operation === 'native' && procedure.trim() ? procedure.trim() : undefined }) });
      setJob(next); setJobs(previous => [next, ...previous].slice(0, 30));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not start analysis.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!job) return;
    try {
      const response = await apiFetch(`/api/rea/jobs/${job.id}/evidence`);
      if (!response.ok) throw new Error('Could not download evidence.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `rea-${job.id}-evidence.json`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError((failure as Error).message); }
  };
  const deleteJob = async () => {
    if (!job) return;
    try {
      const response = await apiFetch(`/api/rea/jobs/${job.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete analysis. Wait for it to stop and try again.');
      setJobs(previous => previous.filter(item => item.id !== job.id)); setJob(null);
    } catch (failure) { setError((failure as Error).message); }
  };
  return <div className="rea-panel">
    <button type="button" aria-expanded={open} aria-controls="rea-workspace" onClick={() => setOpen(!open)}>REA · Reverse engineering</button>
    {open && <section id="rea-workspace" aria-label="REA reverse engineering" tabIndex={0}>
      <h2>Analyze a local artifact</h2>
      <p>Inspect JavaScript, archives, Windows binaries, .NET assemblies and model files. Static analysis does not run the selected program.</p>
      {!status && !error && <p role="status">Connecting to REA…</p>}
      {status && <p>REA {status.version || 'not installed'} · {status.available ? 'Ready for analysis' : 'Setup required: run npm run setup:rea and restart the chatbot.'}</p>}
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="rea-path">Local file or directory</label>
        <input id="rea-path" value={target} onChange={event => setTarget(event.target.value)} disabled={!!file} placeholder="Absolute path or path inside the workspace" />
        {status && <p className="rea-hint">Allowed directories: {status.allowedRoots.join(', ')}</p>}
        <label htmlFor="rea-upload">Or upload an artifact{status ? ` (up to ${Math.floor(status.maxInputBytes / 1048576)} MB)` : ''}</label>
        <input id="rea-upload" type="file" onChange={event => setFile(event.target.files?.[0] || null)} />
        <label htmlFor="rea-operation">Analysis</label>
        <select id="rea-operation" value={operation} onChange={event => setOperation(event.target.value)}>
          <option value="auto">Detect from target</option><option value="javascript">JavaScript / Electron</option>
          <option value="archive">Archive / application package</option><option value="pe">Windows PE imports and resources</option>
          <option value="managed">.NET assembly</option><option value="native">Native overview / decompile function</option><option value="model">Model artifact</option>
        </select>
        {operation === 'native' && <><label htmlFor="rea-procedure">Function name or address (optional)</label>
          <input id="rea-procedure" value={procedure} onChange={event => setProcedure(event.target.value)} />
          <p className="rea-hint">Native analysis needs a compatible REA provider, such as Ghidra, installed separately.</p></>}
        <button type="submit" disabled={busy || !status?.available || (!file && !target.trim())}>{busy ? 'Starting…' : 'Analyze artifact'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {job && <article aria-label="Analysis result">
        <h3>{job.target}</h3><p role="status">Analysis {job.status} · {job.id}</p>
        {job.error && <p role="alert">{job.error}</p>}
        {running(job) && <button type="button" onClick={() => { void request<Job>(`/jobs/${job.id}/cancel`, { method: 'POST' }).then(setJob).catch(failure => setError(failure.message)); }}>Cancel analysis</button>}
        {job.input?.limitations.map(item => <p key={item}>{item}</p>)}
        {job.evidenceSha256 && <>
          <p>Observed results and provider limitations are recorded below. Runtime behavior remains unverified.</p>
          {job.steps?.filter(step => step.evidenceId).map(step => <details key={step.tool}><summary>{step.tool} · {step.evidenceId}</summary><pre>{JSON.stringify(step.result, null, 2).slice(0, 16000)}</pre></details>)}
          <button type="button" onClick={() => void download()}>Download evidence bundle</button>
          <p className="rea-hint">Evidence SHA-256: {job.evidenceSha256}</p>
        </>}
        {!running(job) && <button type="button" onClick={() => void deleteJob()}>Delete analysis and saved files</button>}
      </article>}
      {jobs.length > 0 && <><h3>Recent analyses</h3><ul>{jobs.map(item => <li key={item.id}>
        <button type="button" onClick={() => { void request<Job>(`/jobs/${item.id}`).then(setJob).catch(failure => setError(failure.message)); }}>{item.target} · {item.id.slice(0, 8)}</button>
      </li>)}</ul></>}
      <p className="rea-hint">Chat commands: /rea status · /rea analyze "path" · /rea result &lt;analysis-id&gt;</p>
    </section>}
  </div>;
}
