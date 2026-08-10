import { ReactNode, useEffect, useRef, useState } from 'react';
import { isStaticPagesBuild } from '../api/runtime';
import './KnowledgeOSPanel.css';

type Summary = {
  entities?: { total: number; byType: Record<string, number> };
  graph?: { nodes: number; edges: number };
  memory?: { total: number; approved: number; pending: number };
  governance?: { recentReportCount: number; recentReports?: EvidenceReport[] };
  knowledgeBase?: {
    persistentStore?: boolean;
    persistence?: { sources: number; chunks: number; embeddings: number };
  };
};

type Entity = { label: string; normalized: string; type: string; confidence: number };
type GraphNode = { label: string; type: string; degree: number };
type WikiPage = { slug: string; title: string; content?: string; frontmatter?: Record<string, string> };
type Memory = { id: string; content: string; tags: string[]; status: string; confidence: number; importance: number };
type EvidenceReport = { id: string; request: string; score: number; createdAt?: string };
type RepoImport = { repo: string; wikiPage?: string; chunks?: number; warnings: string[] };
type LibrarySource = {
  id: string;
  source: string;
  sourceType?: string;
  title: string;
  author?: string;
  publishedDate?: string;
  fileExtension?: string;
  citationLabel: string;
  chunks: number;
  embeddings: number;
  warnings: string[];
  needsOcr: boolean;
  duplicateCount: number;
  latestRun?: { status?: string; completedAt?: string };
};
type LibrarySourceResponse = { sources: LibrarySource[]; total: number; limit: number; offset: number };
type Tab = 'overview' | 'library' | 'entities' | 'graph' | 'wiki' | 'memory' | 'evidence' | 'imports';

type ActionState = {
  label: string;
  kind: 'idle' | 'success' | 'error';
};

function KnowledgeOSPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ActionState>({ label: '', kind: 'idle' });
  const [entityQuery, setEntityQuery] = useState('FL Studio');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);
  const [wikiDraft, setWikiDraft] = useState({ slug: 'notes/new-page', title: 'New Page', content: '' });
  const [memories, setMemories] = useState<Memory[]>([]);
  const [reports, setReports] = useState<EvidenceReport[]>([]);
  const [imports, setImports] = useState<RepoImport[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySources, setLibrarySources] = useState<LibrarySource[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryNeedsOcr, setLibraryNeedsOcr] = useState(false);
  const [libraryDuplicatesOnly, setLibraryDuplicatesOnly] = useState(false);
  const [ocrQueueTotal, setOcrQueueTotal] = useState(0);
  const mountedRef = useRef(true);

  const loadSummary = async () => {
    if (isStaticPagesBuild) {
      setSummary({ knowledgeBase: { persistentStore: false } });
      setAction({ label: 'Knowledge OS APIs require the local backend.', kind: 'idle' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/knowledge-os/summary');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (mountedRef.current) {
        setSummary(data);
        setReports(data.governance?.recentReports || []);
      }
    } catch (error: any) {
      if (mountedRef.current) {
        setAction({ label: `Summary failed: ${error.message}`, kind: 'error' });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    loadSummary();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestJson = async (url: string, options: RequestInit = {}) => {
    if (isStaticPagesBuild) {
      throw new Error('Knowledge OS APIs require the local backend.');
    }
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  const runAction = async (label: string, action: () => Promise<any>) => {
    setAction({ label: `${label}...`, kind: 'idle' });
    try {
      const data = await action();
      if (!mountedRef.current) return data;
      setAction({ label: `${label} complete`, kind: 'success' });
      await loadSummary();
      return data;
    } catch (error: any) {
      if (mountedRef.current) setAction({ label: `${label} failed: ${error.message}`, kind: 'error' });
    }
  };

  const searchEntities = () => runAction('Entity search', async () => {
    const data = await requestJson(`/api/knowledge-os/entities/search?q=${encodeURIComponent(entityQuery)}&limit=25`);
    setEntities(data.entities || []);
  });

  const buildGraph = () => runAction('Graph build', async () => {
    const data = await requestJson('/api/knowledge-os/graph/build', {
      method: 'POST',
      body: JSON.stringify({ includeRepo: true, includeRag: true, persist: true, maxFiles: 200, maxChunks: 300 })
    });
    setGraphNodes(data.centrality || []);
  });

  const searchWiki = () => runAction('Wiki search', async () => {
    const url = wikiQuery.trim()
      ? `/api/knowledge-os/wiki/search?q=${encodeURIComponent(wikiQuery)}`
      : '/api/knowledge-os/wiki/pages';
    const data = await requestJson(url);
    setWikiPages(data.pages || []);
  });

  const saveWikiPage = () => runAction('Wiki save', async () => {
    const data = await requestJson('/api/knowledge-os/wiki/pages', {
      method: 'POST',
      body: JSON.stringify(wikiDraft)
    });
    setWikiPages(prev => [data.page, ...prev.filter(page => page.slug !== data.page.slug)]);
  });

  const loadMemories = () => runAction('Memory load', async () => {
    const data = await requestJson('/api/knowledge-os/memory/recall?includePending=true&limit=50');
    setMemories(data.memories || []);
  });

  const approveMemory = (id: string, status: 'approved' | 'rejected') => runAction('Memory approval', async () => {
    await requestJson(`/api/knowledge-os/memory/${id}/approval`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    await loadMemories();
  });

  const loadReports = () => runAction('Evidence load', async () => {
    const data = await requestJson('/api/knowledge-os/governance/evidence?limit=25');
    setReports(data.reports || []);
  });

  const importRepos = () => runAction('Repository import', async () => {
    const data = await requestJson('/api/knowledge-os/import/repositories', {
      method: 'POST',
      body: JSON.stringify({ ingestToRag: false })
    });
    setImports(data.results || []);
  });

  const loadLibrary = () => runAction('Library load', async () => {
    const params = new URLSearchParams({
      limit: '75',
      offset: '0'
    });
    if (libraryQuery.trim()) params.set('q', libraryQuery.trim());
    if (libraryNeedsOcr) params.set('needsOcr', 'true');
    if (libraryDuplicatesOnly) params.set('duplicates', 'true');

    const data: LibrarySourceResponse = await requestJson(`/api/knowledge-base/sources?${params.toString()}`);
    setLibrarySources(data.sources || []);
    setLibraryTotal(data.total || 0);

    const queue: LibrarySourceResponse = await requestJson('/api/knowledge-base/ocr-queue?limit=1');
    setOcrQueueTotal(queue.total || 0);
  });

  useEffect(() => {
    if (open && activeTab === 'library' && librarySources.length === 0 && !isStaticPagesBuild) {
      void loadLibrary();
    }
  }, [open, activeTab]);

  const persistence = summary?.knowledgeBase?.persistence;

  return (
    <section className={`knowledge-os ${open ? 'open' : ''}`} aria-label="Knowledge OS">
      <button className="knowledge-os-toggle" type="button" onClick={() => setOpen(value => !value)}>
        <span>Knowledge OS</span>
        <span className="knowledge-os-pill">{summary?.knowledgeBase?.persistentStore ? 'DB on' : 'DB off'}</span>
      </button>

      {open && (
        <div className="knowledge-os-body">
          <nav className="knowledge-os-tabs" aria-label="Knowledge OS screens">
            {(['overview', 'library', 'entities', 'graph', 'wiki', 'memory', 'evidence', 'imports'] as Tab[]).map(tab => (
              <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' && (
            <>
              <div className="knowledge-os-grid">
                <Stat label="Sources" value={persistence?.sources ?? 0} />
                <Stat label="Chunks" value={persistence?.chunks ?? 0} />
                <Stat label="Entities" value={summary?.entities?.total ?? 0} />
                <Stat label="Graph" value={`${summary?.graph?.nodes ?? 0}/${summary?.graph?.edges ?? 0}`} />
                <Stat label="Memory" value={summary?.memory?.approved ?? 0} sub={`${summary?.memory?.pending ?? 0} pending`} />
                <Stat label="Evidence" value={summary?.governance?.recentReportCount ?? 0} />
              </div>
              <div className="knowledge-os-actions">
                <button type="button" onClick={loadSummary} disabled={loading}>Refresh</button>
                <button type="button" onClick={buildGraph}>Build graph</button>
                <button type="button" onClick={() => runAction('Wiki ingest', () => requestJson('/api/knowledge-os/wiki/ingest', { method: 'POST', body: JSON.stringify({ generateEmbeddings: false }) }))}>
                  Ingest wiki
                </button>
              </div>
            </>
          )}

          {activeTab === 'library' && (
            <Screen title="Library Sources">
              <ControlRow>
                <input value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} placeholder="Search title, author, or path..." />
                <button type="button" onClick={loadLibrary}>Refresh</button>
              </ControlRow>
              <div className="knowledge-os-switches">
                <label>
                  <input type="checkbox" checked={libraryNeedsOcr} onChange={event => setLibraryNeedsOcr(event.target.checked)} />
                  <span>Needs OCR</span>
                </label>
                <label>
                  <input type="checkbox" checked={libraryDuplicatesOnly} onChange={event => setLibraryDuplicatesOnly(event.target.checked)} />
                  <span>Duplicates</span>
                </label>
                <span>{formatNumber(libraryTotal)} sources · {formatNumber(ocrQueueTotal)} OCR queued</span>
              </div>
              <div className="knowledge-os-list knowledge-os-library-list">
                {librarySources.length === 0 && <span className="knowledge-os-empty">No library sources loaded yet.</span>}
                {librarySources.map(source => (
                  <div className="knowledge-os-row knowledge-os-source-row" key={source.id}>
                    <strong>{source.title}</strong>
                    <small>
                      {[source.author, source.publishedDate, source.fileExtension || source.sourceType].filter(Boolean).join(' · ') || source.sourceType || 'source'}
                    </small>
                    <span className="knowledge-os-path">{source.source}</span>
                    <div className="knowledge-os-badges">
                      <Badge>{formatNumber(source.chunks)} chunks</Badge>
                      <Badge>{formatNumber(source.embeddings)} embeddings</Badge>
                      {source.needsOcr && <Badge tone="warn">OCR</Badge>}
                      {source.duplicateCount > 1 && <Badge tone="info">{source.duplicateCount} copies</Badge>}
                      {source.warnings.length > 0 && <Badge tone="warn">{source.warnings.length} warnings</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </Screen>
          )}

          {activeTab === 'entities' && (
            <Screen title="Entity Search">
              <ControlRow>
                <input value={entityQuery} onChange={event => setEntityQuery(event.target.value)} placeholder="Search entities..." />
                <button type="button" onClick={searchEntities}>Search</button>
              </ControlRow>
              <ResultList items={entities.map(entity => `${entity.label} -> ${entity.normalized} (${entity.type}, ${entity.confidence.toFixed(2)})`)} />
            </Screen>
          )}

          {activeTab === 'graph' && (
            <Screen title="Graph Explorer">
              <ControlRow>
                <button type="button" onClick={buildGraph}>Build and persist graph</button>
              </ControlRow>
              <ResultList items={graphNodes.map(node => `${node.label} (${node.type}) degree ${node.degree}`)} empty="No graph nodes loaded yet." />
            </Screen>
          )}

          {activeTab === 'wiki' && (
            <Screen title="Wiki Editor">
              <ControlRow>
                <input value={wikiQuery} onChange={event => setWikiQuery(event.target.value)} placeholder="Search wiki..." />
                <button type="button" onClick={searchWiki}>Search/List</button>
              </ControlRow>
              <div className="knowledge-os-editor">
                <input value={wikiDraft.slug} onChange={event => setWikiDraft({ ...wikiDraft, slug: event.target.value })} placeholder="slug" />
                <input value={wikiDraft.title} onChange={event => setWikiDraft({ ...wikiDraft, title: event.target.value })} placeholder="title" />
                <textarea value={wikiDraft.content} onChange={event => setWikiDraft({ ...wikiDraft, content: event.target.value })} placeholder="Write canonical local knowledge..." />
                <button type="button" onClick={saveWikiPage}>Save page</button>
              </div>
              <ResultList items={wikiPages.map(page => `${page.title} (${page.slug})`)} empty="No wiki pages loaded yet." />
            </Screen>
          )}

          {activeTab === 'memory' && (
            <Screen title="Memory Approval">
              <ControlRow>
                <button type="button" onClick={loadMemories}>Load memories</button>
              </ControlRow>
              <div className="knowledge-os-list">
                {memories.length === 0 && <span className="knowledge-os-empty">No memories loaded yet.</span>}
                {memories.map(memory => (
                  <div className="knowledge-os-row" key={memory.id}>
                    <span>{memory.content}</span>
                    <small>{memory.status} · {memory.confidence.toFixed(2)}</small>
                    {memory.status === 'pending' && (
                      <div className="knowledge-os-row-actions">
                        <button type="button" onClick={() => approveMemory(memory.id, 'approved')}>Approve</button>
                        <button type="button" onClick={() => approveMemory(memory.id, 'rejected')}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Screen>
          )}

          {activeTab === 'evidence' && (
            <Screen title="Evidence Reports">
              <ControlRow>
                <button type="button" onClick={loadReports}>Load reports</button>
              </ControlRow>
              <ResultList items={reports.map(report => `${report.request || report.id} · score ${Number(report.score || 0).toFixed(2)}`)} empty="No evidence reports yet." />
            </Screen>
          )}

          {activeTab === 'imports' && (
            <Screen title="Repo Importers">
              <ControlRow>
                <button type="button" onClick={importRepos}>Import recommended repos</button>
              </ControlRow>
              <ResultList items={imports.map(item => `${item.repo} -> ${item.wikiPage || 'wiki skipped'}${item.warnings.length ? ` (${item.warnings.length} warnings)` : ''}`)} empty="No imports run yet." />
            </Screen>
          )}

          {action.label && <div className={`knowledge-os-status ${action.kind}`}>{action.label}</div>}
        </div>
      )}
    </section>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="knowledge-os-screen">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ControlRow({ children }: { children: ReactNode }) {
  return <div className="knowledge-os-control-row">{children}</div>;
}

function ResultList({ items, empty = 'No results yet.' }: { items: string[]; empty?: string }) {
  return (
    <div className="knowledge-os-list">
      {items.length === 0 && <span className="knowledge-os-empty">{empty}</span>}
      {items.map(item => <div className="knowledge-os-row" key={item}>{item}</div>)}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="knowledge-os-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warn' | 'info' }) {
  return <span className={`knowledge-os-badge ${tone}`}>{children}</span>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Number(value || 0));
}

export default KnowledgeOSPanel;
