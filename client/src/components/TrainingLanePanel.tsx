import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import './KnowledgeOSPanel.css';
import {
  Book,
  BooksReport,
  FORMATS,
  Format,
  LICENSES,
  License,
  MODES,
  Mode,
  Notice,
  Pair,
  Sample,
  api,
  describeError,
  trainingBlockers
} from './trainingLane';

export { trainingBlockers };

export function TrainingLanePanel(): ReactNode {
  const [report, setReport] = useState<BooksReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [seed, setSeed] = useState(42);
  const [modes, setModes] = useState<Set<Mode>>(new Set(['sft']));
  const [formats, setFormats] = useState<Set<Format>>(new Set(['jsonl']));
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [bundle, setBundle] = useState<{ bundleDir: string; manifest: any } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async <T,>(label: string, work: () => Promise<T>, success?: (value: T) => string): Promise<T | undefined> => {
    setBusy(label);
    try {
      const value = await work();
      if (mounted.current && success) setNotice({ kind: 'success', text: success(value) });
      return value;
    } catch (error) {
      if (mounted.current) setNotice(describeError(error));
      return undefined;
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const loadBooks = useCallback(async () => {
    try {
      const data = await api<BooksReport>('/api/knowledge-base/dabook/books');
      if (mounted.current) setReport(data);
    } catch (error) {
      if (mounted.current) setNotice(describeError(error));
    }
  }, []);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  const book = report?.books.find(b => b.sha256 === selected) ?? null;

  const loadSample = async (sha: string, nextSeed: number) => {
    const data = await api<Sample>(`/api/knowledge-base/dabook/review/sample?book=${sha}&n=10&seed=${nextSeed}`);
    if (mounted.current) { setSample(data); setSeed(nextSeed); }
    return data;
  };

  const openReview = (sha: string) => run('Loading pairs', async () => {
    setSelected(sha);
    return loadSample(sha, 42);
  });

  const setLicense = (target: Book, status: License) => run('Saving license', async () => {
    await api('/api/knowledge-base/dabook/license', { method: 'POST', body: JSON.stringify({ book: target.sha256, status }) });
    await loadBooks();
  }, () => `License set to ${status}`);

  const decide = (pair: Pair, decision: 'accept' | 'reject') => run('Saving decision', async () => {
    await api('/api/knowledge-base/dabook/review/decision', {
      method: 'POST',
      body: JSON.stringify({ book: selected, pairId: pair.pair_id, decision })
    });
    if (mounted.current) {
      setSample(prev => prev && { ...prev, decided: prev.decided + (pair.decision ? 0 : 1), sample: prev.sample.map(p => p.pair_id === pair.pair_id ? { ...p, decision } : p) });
    }
  });

  const markBook = (status: 'approved' | 'rejected') => run('Saving review', async () => {
    await api('/api/knowledge-base/dabook/review/book', { method: 'POST', body: JSON.stringify({ book: selected, status }) });
    await loadBooks();
  }, () => `Book ${status}`);

  const applyRejections = () => run('Recompiling', async () => {
    await api('/api/knowledge-base/dabook/recompile', { method: 'POST', body: JSON.stringify({ book: selected }) });
    await loadBooks();
    if (selected) await loadSample(selected, seed);
  }, () => 'Rejected pairs removed from the dataset');

  const exportBundle = () => run('Exporting', async () => {
    setBundle(null);
    const result = await api<{ bundleDir: string; manifest: any }>('/api/knowledge-base/dabook/training-export', {
      method: 'POST',
      body: JSON.stringify({ modes: [...modes], formats: [...formats] })
    });
    if (mounted.current) setBundle(result);
    return result;
  }, result => `Exported to ${result.bundleDir}`);

  const toggle = <T,>(set: Set<T>, value: T, update: (next: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    update(next);
  };

  const policy = report?.policy;

  return (
    <div className="knowledge-os-screen">
      <h3>Training data lane</h3>
      <p className="knowledge-os-empty">
        Book-derived training data needs an owned, permissive or public-domain license and a review. Other books stay RAG-only.
      </p>

      <div className="knowledge-os-control-row">
        <button type="button" onClick={() => void loadBooks()} disabled={!!busy}>Reload books</button>
        {busy && <span role="status">{busy}…</span>}
      </div>

      <div className="knowledge-os-list knowledge-os-library-list" aria-label="Books">
        {report && report.books.length === 0 && <span className="knowledge-os-empty">No DABOOK books yet.</span>}
        {report?.books.map(entry => {
          const blockers = policy ? trainingBlockers(entry, policy) : [];
          const name = entry.title || entry.sha256.slice(0, 12);
          return (
            <div className="knowledge-os-row knowledge-os-source-row" key={entry.sha256}>
              <strong>{name}</strong>
              <div className="knowledge-os-badges">
                <Badge>{entry.state}</Badge>
                <Badge>{`review: ${entry.review_status ?? 'unreviewed'}`}</Badge>
                {entry.quality_score != null && <Badge>{`quality ${entry.quality_score.toFixed(2)}`}</Badge>}
                <Badge>{`${entry.counts.sft ?? 0} sft pairs`}</Badge>
                {blockers.length === 0
                  ? <Badge tone="info">Training-ready</Badge>
                  : <Badge tone="warn">{`RAG only: ${blockers.join(', ')}`}</Badge>}
              </div>
              <div className="knowledge-os-row-actions">
                <label>
                  <span>{`License for ${name}`}</span>
                  <select
                    aria-label={`License for ${name}`}
                    value={entry.license_status ?? 'unknown'}
                    disabled={!!busy}
                    onChange={event => void setLicense(entry, event.target.value as License)}
                  >
                    {LICENSES.map(license => <option key={license} value={license}>{license}</option>)}
                  </select>
                </label>
                <button type="button" disabled={!!busy || (entry.counts.sft ?? 0) === 0} onClick={() => void openReview(entry.sha256)}>
                  {`Review ${name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {book && sample && (
        <section aria-label="Review">
          <h4>{`Review: ${book.title || book.sha256.slice(0, 12)}`}</h4>
          <p>{`${sample.decided} of ${sample.total_pairs} pairs decided · showing ${sample.sample.length}`}</p>
          <div className="knowledge-os-list">
            {sample.sample.map(pair => (
              <article className="knowledge-os-row" key={pair.pair_id} aria-label={`Pair ${pair.pair_id}`}>
                <strong>{pair.question}</strong>
                <span>{pair.answer}</span>
                <small>{`p. ${pair.pages[0]}${pair.pages[1] !== pair.pages[0] ? `–${pair.pages[1]}` : ''} · ${pair.breadcrumbs.join(' › ') || 'front matter'} · ${pair.category}`}</small>
                {pair.evidence && <small>{`Evidence: ${pair.evidence}`}</small>}
                <details>
                  <summary>Source excerpt</summary>
                  <pre>{pair.source_excerpt}</pre>
                </details>
                <div className="knowledge-os-row-actions">
                  <button type="button" aria-pressed={pair.decision === 'accept'} disabled={!!busy} onClick={() => void decide(pair, 'accept')}>Accept</button>
                  <button type="button" aria-pressed={pair.decision === 'reject'} disabled={!!busy} onClick={() => void decide(pair, 'reject')}>Reject</button>
                  {pair.decision && <Badge tone={pair.decision === 'reject' ? 'warn' : 'info'}>{pair.decision === 'reject' ? 'rejected' : 'accepted'}</Badge>}
                </div>
              </article>
            ))}
          </div>
          <div className="knowledge-os-actions">
            <button type="button" disabled={!!busy} onClick={() => void run('Loading pairs', () => loadSample(book.sha256, seed + 1))}>Another sample</button>
            <button type="button" disabled={!!busy} onClick={() => void applyRejections()}>Apply rejections</button>
            <button type="button" disabled={!!busy} onClick={() => void markBook('approved')}>Approve book</button>
            <button type="button" disabled={!!busy} onClick={() => void markBook('rejected')}>Reject book</button>
          </div>
        </section>
      )}

      <section aria-label="Export">
        <h4>Export training bundle</h4>
        <div className="knowledge-os-control-row">
          {MODES.map(mode => (
            <label key={mode}>
              <input type="checkbox" checked={modes.has(mode)} onChange={() => toggle(modes, mode, setModes)} />
              <span>{mode}</span>
            </label>
          ))}
          {FORMATS.map(format => (
            <label key={format}>
              <input type="checkbox" checked={formats.has(format)} onChange={() => toggle(formats, format, setFormats)} />
              <span>{format}</span>
            </label>
          ))}
          <button type="button" disabled={!!busy || modes.size === 0 || formats.size === 0} onClick={() => void exportBundle()}>
            Export training bundle
          </button>
        </div>
        {bundle && (
          <div className="knowledge-os-row" aria-label="Export result">
            <strong>{bundle.bundleDir}</strong>
            <small>
              {Object.entries(bundle.manifest.counts as Record<string, Record<string, number>>)
                .map(([mode, splits]) => `${mode}: ${Object.entries(splits).map(([split, n]) => `${split} ${n}`).join(' / ')}`)
                .join(' · ')}
            </small>
            <small>
              {`Contamination audit: ${bundle.manifest.governance?.embeddedEvaluationScan?.matches ?? 0} matches across ${bundle.manifest.governance?.evaluation?.items ?? 0} evaluation items`}
            </small>
          </div>
        )}
      </section>

      {notice && (
        <div className={`knowledge-os-status ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.text}
          {notice.lines && notice.lines.length > 0 && (
            <ul>{notice.lines.map(line => <li key={line}>{line}</li>)}</ul>
          )}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warn' | 'info' }) {
  return <span className={`knowledge-os-badge ${tone}`}>{children}</span>;
}

export default TrainingLanePanel;
