import { useState } from 'react';

const starter = { name: 'My local site', theme: { background: '#171717', foreground: '#f5f5f5', accent: '#a3a3a3' }, pages: [{ slug: 'home', title: 'A simple page', blocks: [{ type: 'hero', title: 'Build something clear.', body: 'A small, safe website workspace for prototypes and knowledge projects.' }, { type: 'features', items: ['Fast local iteration', 'Simple content blocks', 'Exportable HTML'] }, { type: 'cta', title: 'Continue exploring', body: 'Open the chatbot', href: '#' }] }] };

export default function WebsiteWorkspacePanel() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(JSON.stringify(starter, null, 2));
  const [preview, setPreview] = useState('');
  const [message, setMessage] = useState('');

  const save = async () => {
    try {
      const project = JSON.parse(source);
      const response = await fetch('/api/website-workspace/project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Save failed (HTTP ${response.status})`);
      setSource(JSON.stringify(data.project, null, 2)); setPreview(data.html); setMessage('Saved locally and rendered in the sandbox.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save website project.'); }
  };

  return <section className="workspace-panel website-workspace-panel">
    <button type="button" className="workspace-panel-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}><span>Website workspace</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    {open && <div className="workspace-panel-body">
      <p className="workspace-help">OpenForge-inspired blocks with a sandboxed preview and HTML export path. Scripts are not enabled in the preview.</p>
      <textarea value={source} onChange={event => setSource(event.target.value)} />
      <div className="workspace-action-row"><button type="button" onClick={save}>Save and preview</button></div>
      {message && <p className="workspace-status">{message}</p>}
      {preview && <iframe className="website-preview" title="Website preview" sandbox="" srcDoc={preview} />}
    </div>}
  </section>;
}
