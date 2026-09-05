import { useState } from 'react';
import { isStaticPagesBuild } from '../api/runtime';
import { MemoryCenterPanel, ProjectMemoryItem } from './MemoryCenterPanel';
import { ArchitectureCardModel, RepositoryArchitectureView } from './RepositoryArchitectureView';

type FileInsight = {
  path: string;
  lines: number;
  symbols: number;
  complexity: number;
  churn: number;
  risk: number;
  recommendation?: string;
};

type Overview = {
  project: { name: string; description: string; type: string; language: string[]; frameworks: string[] };
  summary: { files: number; lines: number; symbols: number; churnedFiles: number; averageRisk: number };
  hotspots: FileInsight[];
  duplicateCandidates: Array<{ signature: string; files: string[] }>;
  recommendations: string[];
};

type MemoryEntry = { id: string; category: string; content: string; tags: string[]; createdAt: string };

const memoryKinds = new Set<ProjectMemoryItem['kind']>([
  'decision', 'gotcha', 'convention', 'flow', 'milestone', 'failure', 'fix', 'context', 'preference', 'changelog', 'note'
]);

function toMemoryItem(entry: MemoryEntry): ProjectMemoryItem {
  const kind = memoryKinds.has(entry.category as ProjectMemoryItem['kind'])
    ? entry.category as ProjectMemoryItem['kind']
    : 'note';
  return {
    id: entry.id,
    kind,
    title: entry.content.split(/\r?\n/, 1)[0].slice(0, 100) || `${kind} memory`,
    content: entry.content,
    branch: 'workspace',
    confidence: 1,
    approvalState: 'approved',
    freshnessState: 'current',
    tags: entry.tags,
    updatedAt: entry.createdAt
  };
}

function toArchitectureCards(overview: Overview): ArchitectureCardModel[] {
  return overview.hotspots.map(item => ({
    id: item.path,
    subsystem: item.path.split(/[\\/]/)[0] || 'workspace',
    title: item.path,
    purpose: item.recommendation || `Repository hotspot with risk ${item.risk}, complexity ${item.complexity}, and ${item.symbols} indexed symbols.`,
    sourceFiles: [{ filePath: item.path, fileDigest: 'not-returned-by-overview', sizeBytes: 0 }],
    keySymbols: [],
    cruxExcerpts: [],
    typedLinks: [],
    entrypoints: [item.path],
    tests: [],
    risksAndGotchas: item.risk >= 60 ? [`Risk score ${item.risk}; inspect this file before high-impact changes.`] : [],
    humanNotes: undefined
  }));
}

export default function ProjectIntelligencePanel() {
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('decision');
  const [status, setStatus] = useState('');

  if (isStaticPagesBuild) return null;

  const request = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  const refresh = async () => {
    setStatus('Analyzing project...');
    try {
      const [project, memory] = await Promise.all([
        request('/api/project-intelligence/overview?maxFiles=250'),
        request('/api/project-memory/entries?limit=12')
      ]);
      setOverview(project);
      setMemories(memory.entries || []);
      setStatus('Project intelligence refreshed');
    } catch (error: any) {
      setStatus(`Refresh failed: ${error.message}`);
    }
  };

  const remember = async () => {
    if (!content.trim()) return;
    setStatus('Saving project memory...');
    try {
      await request('/api/project-memory/entries', {
        method: 'POST',
        body: JSON.stringify({ content, category, tags: ['chatbot'] })
      });
      setContent('');
      await refresh();
      setStatus('Project memory saved');
    } catch (error: any) {
      setStatus(`Memory save failed: ${error.message}`);
    }
  };

  const resume = async () => {
    try {
      const data = await request('/api/project-memory/resume', { method: 'POST', body: '{}' });
      setStatus(`Generated ${data.path} from ${data.entries} entries`);
    } catch (error: any) {
      setStatus(`Resume failed: ${error.message}`);
    }
  };

  return (
    <section className={`project-intelligence-panel ${open ? 'open' : ''}`} aria-label="Project intelligence">
      <button className="project-intelligence-toggle" type="button" onClick={() => { setOpen(value => !value); if (!open && !overview) void refresh(); }}>
        <span>Project intelligence</span>
        <span className="status-pill">{overview ? `${overview.summary.files} files` : 'Ready'}</span>
      </button>
      {open && (
        <div className="project-intelligence-body">
          <div className="project-intelligence-actions">
            <button type="button" onClick={() => void refresh()}>Refresh map</button>
            <button type="button" onClick={() => void resume()}>Regenerate memory</button>
          </div>
          {overview && (
            <>
              <div className="project-intelligence-summary">
                <span><strong>{overview.project.name}</strong> · {overview.project.type}</span>
                <span>{overview.summary.lines.toLocaleString()} lines · {overview.summary.symbols.toLocaleString()} symbols · average risk {overview.summary.averageRisk}</span>
              </div>
              <div className="project-intelligence-list">
                {overview.hotspots.slice(0, 8).map(item => (
                  <article key={item.path}>
                    <strong>{item.path}</strong>
                    <small>risk {item.risk} · {item.lines} lines · complexity {item.complexity} · churn {item.churn}</small>
                    {item.recommendation && <span>{item.recommendation}</span>}
                  </article>
                ))}
              </div>
              <div className="project-intelligence-recommendations">
                {overview.recommendations.map(item => <span key={item}>{item}</span>)}
              </div>
            </>
          )}
          <div className="project-memory-editor">
            <label>
              Memory type
              <select value={category} onChange={event => setCategory(event.target.value)}>
                <option value="decision">Decision</option>
                <option value="gotcha">Gotcha</option>
                <option value="changelog">Changelog</option>
                <option value="note">Note</option>
                <option value="context">Context</option>
              </select>
            </label>
            <textarea value={content} onChange={event => setContent(event.target.value)} placeholder="Save a project decision, gotcha, or context..." />
            <button type="button" onClick={() => void remember()} disabled={!content.trim()}>Remember</button>
          </div>
          {overview && overview.hotspots.length > 0 && (
            <div className="project-architecture-workspace">
              <RepositoryArchitectureView cards={toArchitectureCards(overview)} />
            </div>
          )}
          <MemoryCenterPanel memories={memories.map(toMemoryItem)} onExportMarkdown={() => void resume()} />
          {status && <div className="project-intelligence-status" role="status">{status}</div>}
        </div>
      )}
    </section>
  );
}
