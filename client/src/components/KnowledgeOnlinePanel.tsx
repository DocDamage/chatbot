import { useState } from 'react';
import {
  checkOnlineKnowledge,
  ingestOnlineKnowledge,
  searchAndIngestOnlineKnowledge,
  searchOnlineKnowledge,
  KnowledgeCheckResult,
  OnlineKnowledgePreview
} from '../api/knowledge';
import './KnowledgeOnlinePanel.css';

function KnowledgeOnlinePanel() {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('ask');
  const [threshold, setThreshold] = useState(0.55);
  const [approvedBy, setApprovedBy] = useState('knowledge-panel');
  const [checkResult, setCheckResult] = useState<KnowledgeCheckResult | null>(null);
  const [preview, setPreview] = useState<OnlineKnowledgePreview | null>(null);
  const [ingestionResult, setIngestionResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await task();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Knowledge online action failed');
    } finally {
      setLoading(false);
    }
  };

  const check = async () => {
    await run(async () => {
      setCheckResult(await checkOnlineKnowledge(query, domain, threshold));
      setIngestionResult(null);
    });
  };

  const search = async () => {
    await run(async () => {
      setPreview(await searchOnlineKnowledge(query, domain));
      setIngestionResult(null);
    });
  };

  const ingestPreview = async () => {
    if (!preview) return;
    await run(async () => {
      setIngestionResult(await ingestOnlineKnowledge(preview, approvedBy || 'knowledge-panel'));
      setPreview(null);
    });
  };

  const searchAndIngest = async () => {
    await run(async () => {
      const result = await searchAndIngestOnlineKnowledge({
        query,
        domain,
        approved: true,
        approvedBy: approvedBy || 'knowledge-panel'
      });
      setPreview(result.preview || null);
      setIngestionResult(result.ingestion || result);
    });
  };

  return (
    <section className="knowledge-online-panel" aria-label="Knowledge online">
      <div className="knowledge-online-header">
        <strong>Knowledge Online</strong>
        <span>Confidence check, online preview, explicit approved ingest</span>
      </div>

      <div className="knowledge-online-controls">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Question or search query" />
        <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="domain" />
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={threshold}
          onChange={event => setThreshold(Number(event.target.value))}
          aria-label="confidence threshold"
        />
        <input value={approvedBy} onChange={event => setApprovedBy(event.target.value)} placeholder="approved by" />
        <button type="button" onClick={check} disabled={loading || !query.trim()}>
          Check
        </button>
        <button type="button" onClick={search} disabled={loading || !query.trim()}>
          Search
        </button>
      </div>

      <div className="knowledge-online-controls">
        <button type="button" onClick={ingestPreview} disabled={loading || !preview}>
          Ingest Current Preview
        </button>
        <button type="button" onClick={searchAndIngest} disabled={loading || !query.trim()}>
          Search + Approved Ingest
        </button>
      </div>

      {error && <div className="knowledge-online-error">{error}</div>}

      <div className="knowledge-online-grid">
        {checkResult && (
          <div className="knowledge-online-card">
            <h4>Confidence result</h4>
            <div className="knowledge-online-metric">
              <span>Confidence: {checkResult.confidence.toFixed(2)}</span>
              <span>{checkResult.needsOnlineResearch ? 'Needs online research' : 'Local answer is sufficient'}</span>
            </div>
            <pre>{checkResult.answer}</pre>
            {checkResult.needsOnlineResearch && (
              <button type="button" onClick={() => setQuery(checkResult.suggestedQuery)} disabled={loading}>
                Use suggested query
              </button>
            )}
          </div>
        )}

        {preview && (
          <div className="knowledge-online-card">
            <h4>Online preview</h4>
            <div className="knowledge-online-metric">
              <span>Accepted: {preview.sourcePolicy.accepted}</span>
              <span>Rejected: {preview.sourcePolicy.rejected.length}</span>
            </div>
            <pre>{preview.answerPreview}</pre>
            <SourceList preview={preview} />
          </div>
        )}

        {ingestionResult !== null && (
          <div className="knowledge-online-card">
            <h4>Ingestion result</h4>
            <pre>{JSON.stringify(ingestionResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </section>
  );
}

function SourceList({ preview }: { preview: OnlineKnowledgePreview }) {
  if (!preview.sources.length) return null;
  return (
    <div className="knowledge-online-source-list">
      {preview.sources.map(source => (
        <div className="knowledge-online-source" key={source.url}>
          <strong>{source.title}</strong>
          <small>{source.url}</small>
          <p>{source.snippet}</p>
        </div>
      ))}
    </div>
  );
}

export default KnowledgeOnlinePanel;
