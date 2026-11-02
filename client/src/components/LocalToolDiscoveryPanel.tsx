import { FormEvent, useState } from 'react';
import {
  detectLocalTools,
  listLocalExecutables,
  LocalExecutableSummary,
  planLocalRun,
  PlannedLocalRun,
  registerLocalExecutable
} from '../api/localTools';

export default function LocalToolDiscoveryPanel() {
  const [executables, setExecutables] = useState<LocalExecutableSummary[]>([]);
  const [name, setName] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [args, setArgs] = useState('');
  const [plan, setPlan] = useState<PlannedLocalRun>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setStatus('');
    try {
      const [detected, registered] = await Promise.all([detectLocalTools(), listLocalExecutables()]);
      const merged = new Map<string, LocalExecutableSummary>();
      for (const item of [...detected.detections, ...registered.executables]) {
        merged.set(item.executablePath || item.toolSlug || item.toolName, item);
      }
      setExecutables(Array.from(merged.values()));
      setStatus(`Found ${merged.size} local executable${merged.size === 1 ? '' : 's'}.`);
    } catch (error: any) {
      setStatus(error.message || 'Local tool detection failed.');
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !executablePath.trim()) return;
    setBusy(true);
    setStatus('');
    try {
      await registerLocalExecutable({ name: name.trim(), executablePath: executablePath.trim(), enabled: true });
      setName('');
      await refresh();
    } catch (error: any) {
      setStatus(error.message || 'Local executable registration failed.');
      setBusy(false);
    }
  };

  const createPlan = async (item: LocalExecutableSummary) => {
    setBusy(true);
    setStatus('');
    try {
      const planned = await planLocalRun({
        toolSlug: item.toolSlug,
        executablePath: item.toolSlug ? undefined : item.executablePath,
        args: args.trim() ? args.trim().split(/\s+/) : [],
        approvedByUser: false
      });
      setPlan(planned);
      setStatus('Run plan created. Review it below, then use the approval queue to approve and start it.');
    } catch (error: any) {
      setStatus(error.message || 'Unable to create local run plan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="local-tool-discovery" aria-label="Local executable discovery">
      <div className="local-tool-discovery-header">
        <div>
          <h3>Local executables</h3>
          <p>Detect or register local tools, then create a reviewable run plan. Planning never starts a process.</p>
        </div>
        <button type="button" onClick={refresh} disabled={busy}>{busy ? 'Checking…' : 'Detect tools'}</button>
      </div>

      <form className="local-tool-register" onSubmit={register}>
        <input aria-label="Executable name" value={name} onChange={event => setName(event.target.value)} placeholder="Tool name" />
        <input aria-label="Executable path" value={executablePath} onChange={event => setExecutablePath(event.target.value)} placeholder="Absolute executable path" />
        <button type="submit" disabled={busy || !name.trim() || !executablePath.trim()}>Register</button>
      </form>

      <label className="local-tool-args">
        Optional arguments for the next plan
        <input value={args} onChange={event => setArgs(event.target.value)} placeholder="Arguments are validated by local tool policy" />
      </label>

      {status && <p className="local-tool-status" role="status">{status}</p>}

      {executables.length > 0 && (
        <ul className="local-tool-results">
          {executables.map(item => (
            <li key={item.executablePath || item.toolSlug || item.toolName}>
              <span><strong>{item.toolName}</strong><small>{item.executablePath || item.executableName}</small></span>
              <span>{item.detected ? 'Detected' : 'Registered'} · {item.enabled ? 'Enabled' : 'Disabled'}</span>
              <button type="button" onClick={() => createPlan(item)} disabled={busy || !item.enabled}>Plan run</button>
            </li>
          ))}
        </ul>
      )}

      {plan && (
        <div className="local-tool-plan">
          <strong>Plan {plan.runId}</strong>
          <code>{plan.resolvedCommand.join(' ')}</code>
          <span>{plan.riskLevel} risk · {plan.requiresApproval ? 'approval required' : 'no approval required'}</span>
        </div>
      )}
    </section>
  );
}
