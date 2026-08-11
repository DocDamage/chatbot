import { useState } from 'react';
import { isStaticPagesBuild } from '../api/runtime';

type Finding = { id: string; severity: 'info' | 'warning'; line?: number; message: string; suggestion: string };

export default function DocumentWorkspacePanel() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Knowledge draft');
  const [content, setContent] = useState('');
  const [token, setToken] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [status, setStatus] = useState('');

  if (isStaticPagesBuild) return null;

  const request = async (url: string, options: RequestInit) => {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  const review = async () => {
    try {
      const data = await request('/api/document-workspace/review', { method: 'POST', body: JSON.stringify({ title, content }) });
      setToken(data.token);
      setFindings(data.findings || []);
      setStatus('Reviewed. Save is enabled only while the draft remains unchanged.');
    } catch (error: any) {
      setStatus(`Review failed: ${error.message}`);
    }
  };

  const transform = async (action: string) => {
    try {
      const data = await request('/api/document-workspace/transform', { method: 'POST', body: JSON.stringify({ action, content }) });
      setContent(data.content);
      setToken('');
      setStatus('Draft changed. Review it again before saving.');
    } catch (error: any) {
      setStatus(`Transform failed: ${error.message}`);
    }
  };

  const save = async () => {
    try {
      const data = await request('/api/document-workspace/save', { method: 'POST', body: JSON.stringify({ title, content, token, domain: 'general' }) });
      setToken('');
      setStatus(`Saved ${data.path}${data.chunks ? ` with ${data.chunks} knowledge chunks` : ''}.`);
    } catch (error: any) {
      setStatus(`Save failed: ${error.message}`);
    }
  };

  return (
    <section className={`document-workspace-panel ${open ? 'open' : ''}`} aria-label="Document workspace">
      <button className="project-intelligence-toggle" type="button" onClick={() => setOpen(value => !value)}>
        <span>Document review workspace</span>
        <span className="status-pill">{token ? 'Reviewed' : 'Draft'}</span>
      </button>
      {open && (
        <div className="document-workspace-body">
          <input value={title} onChange={event => { setTitle(event.target.value); setToken(''); }} placeholder="Document title" />
          <textarea value={content} onChange={event => { setContent(event.target.value); setToken(''); }} placeholder="Write or paste a knowledge-base document..." />
          <div className="project-intelligence-actions">
            <button type="button" onClick={() => void review()} disabled={!content.trim()}>Review draft</button>
            <button type="button" onClick={() => void transform('concise')} disabled={!content.trim()}>Concise</button>
            <button type="button" onClick={() => void transform('professional')} disabled={!content.trim()}>Professional</button>
            <button type="button" onClick={() => void transform('bullet-list')} disabled={!content.trim()}>Bullets</button>
            <button type="button" onClick={() => void save()} disabled={!token}>Save reviewed</button>
          </div>
          {findings.map(finding => <article className="document-review-finding" key={finding.id}><strong>{finding.severity}{finding.line ? ` · line ${finding.line}` : ''}</strong><span>{finding.message}</span><small>{finding.suggestion}</small></article>)}
          {status && <div className="project-intelligence-status" role="status">{status}</div>}
        </div>
      )}
    </section>
  );
}
