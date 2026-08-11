import { useEffect, useState } from 'react';

interface Collection { name: string; records: Array<Record<string, unknown>>; updatedAt: string; }

export default function MockApiWorkspacePanel() {
  const [open, setOpen] = useState(false);
  const [collection, setCollection] = useState('records');
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [content, setContent] = useState('[{"name":"Example","status":"ready"}]');
  const [saved, setSaved] = useState<Collection | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { if (open) void fetch('/api/mock-api/status').catch(() => undefined); }, [open]);

  const importData = async () => {
    setMessage('');
    const response = await fetch('/api/mock-api/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection, format, content }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error || `Import failed (HTTP ${response.status})`); return; }
    setSaved(data.collection); setMessage(`Ready at ${data.endpoint}`);
  };

  return <section className="workspace-panel mock-api-panel">
    <button type="button" className="workspace-panel-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}><span>Mock API sandbox</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    {open && <div className="workspace-panel-body">
      <p className="workspace-help">Capsule-inspired local fixtures for Build and Debug. Data stays in the local <code>data/mock-api</code> folder.</p>
      <div className="workspace-inline-fields"><label>Collection<input value={collection} onChange={event => setCollection(event.target.value)} /></label><label>Format<select value={format} onChange={event => setFormat(event.target.value as 'json' | 'csv')}><option value="json">JSON</option><option value="csv">CSV</option></select></label></div>
      <textarea value={content} onChange={event => setContent(event.target.value)} />
      <div className="workspace-action-row"><button type="button" onClick={importData}>Import fixture</button></div>
      {message && <p className="workspace-status">{message}</p>}
      {saved && <pre className="workspace-result">{JSON.stringify(saved.records, null, 2)}</pre>}
    </div>}
  </section>;
}
