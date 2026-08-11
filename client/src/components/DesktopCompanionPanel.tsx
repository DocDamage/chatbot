import { useEffect, useState } from 'react';

interface CompanionCapabilities { available: boolean; message: string; features: Record<string, boolean>; consent: Record<string, string>; }

export default function DesktopCompanionPanel() {
  const [open, setOpen] = useState(false);
  const [capabilities, setCapabilities] = useState<CompanionCapabilities | null>(null);
  const [context, setContext] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => { if (open) void fetch('/api/desktop-companion/capabilities').then(response => response.json()).then(setCapabilities).catch(() => setMessage('Companion status is unavailable.')); }, [open]);

  const saveContext = async () => {
    const response = await fetch('/api/desktop-companion/context', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'transcript', content: context }) });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? 'Context accepted with explicit persistence.' : data.error || 'Context was not accepted.');
    if (response.ok) setContext('');
  };

  return <section className="workspace-panel desktop-companion-panel">
    <button type="button" className="workspace-panel-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}><span>Desktop companion</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    {open && <div className="workspace-panel-body">
      <p className="workspace-help">SpeakoFlow-inspired integration boundary for an optional native companion. The browser never captures your screen automatically.</p>
      {capabilities && <div className="companion-capability-list"><span>{capabilities.available ? 'Connected' : 'Not connected'}</span><span>Voice: explicit</span><span>Screen: explicit</span></div>}
      <textarea value={context} onChange={event => setContext(event.target.value)} placeholder="Paste an approved transcript or screen summary..." />
      <div className="workspace-action-row"><button type="button" onClick={saveContext} disabled={!context.trim()}>Store approved context</button></div>
      {message && <p className="workspace-status">{message}</p>}
    </div>}
  </section>;
}
