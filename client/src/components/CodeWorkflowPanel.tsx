import { useRef, useState } from 'react';
import {
  askCodeAgent,
  createCodePatch,
  getCodeSymbols,
  planCodeWork,
  reviewCodeDiff,
  searchCodeFiles,
  verifyCode,
  CodeSearchResult
} from '../api/code';
import { ChatMode } from './ModeSelector';
import './CodeWorkflowPanel.css';

interface CodeWorkflowPanelProps {
  mode: ChatMode;
}

function CodeWorkflowPanel({ mode }: CodeWorkflowPanelProps) {
  const [query, setQuery] = useState('');
  const [patchPrompt, setPatchPrompt] = useState('');
  const [diff, setDiff] = useState('');
  const [results, setResults] = useState<CodeSearchResult[]>([]);
  const [symbols, setSymbols] = useState<any[]>([]);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const canPatch = mode === 'implement';
  const canVerify = mode === 'implement' || mode === 'debug';

  const run = async (task: () => Promise<unknown>) => {
    setLoading(true);
    setError('');
    try {
      const data = await task();
      setOutput(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setError(error.message || 'Code workflow failed');
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    await run(async () => {
      const data = await searchCodeFiles(query, controller.signal);
      setResults(data);
      setSymbols([]);
      return { results: data };
    });
  };

  const loadSymbols = async (path: string) => {
    await run(async () => {
      const data = await getCodeSymbols(path);
      setSymbols(data);
      return { file: path, symbols: data };
    });
  };

  return (
    <section className="code-workflow-panel" aria-label="Code workflows">
      <div className="code-workflow-header">
        <strong>Code Workflows</strong>
        <button
          type="button"
          onClick={() => run(() => verifyCode(['npm run type-check'], mode))}
          disabled={loading || !canVerify}
          title={canVerify ? 'Run code verification' : 'Switch to Implement or Debug mode to verify code'}
        >
          Verify Typecheck
        </button>
      </div>

      <div className="code-workflow-search">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search code files" />
        <button type="button" onClick={search} disabled={loading || !query.trim()}>Search</button>
      </div>

      {results.length > 0 && (
        <div className="code-workflow-results">
          {results.slice(0, 8).map(result => (
            <button key={result.path} type="button" onClick={() => loadSymbols(result.path)}>
              {result.path}
            </button>
          ))}
        </div>
      )}

      {symbols.length > 0 && (
        <div className="code-workflow-symbols">
          {symbols.slice(0, 12).map((symbol, index) => (
            <span key={`${symbol.name || 'symbol'}-${index}`}>{symbol.name || String(symbol)}</span>
          ))}
        </div>
      )}

      <div className="code-workflow-grid">
        <label>
          <span>Code prompt</span>
          <textarea value={patchPrompt} onChange={event => setPatchPrompt(event.target.value)} rows={3} />
          <div className="code-workflow-actions">
            <button type="button" onClick={() => run(() => askCodeAgent(patchPrompt, false))} disabled={loading || !patchPrompt.trim()}>
              Ask Agent
            </button>
            <button type="button" onClick={() => run(() => planCodeWork(patchPrompt))} disabled={loading || !patchPrompt.trim()}>
              Plan Work
            </button>
            <button
              type="button"
              onClick={() => run(() => createCodePatch(patchPrompt, mode))}
              disabled={loading || !patchPrompt.trim() || !canPatch}
              title={canPatch ? 'Create patch' : 'Switch to Implement mode to create patches'}
            >
              Create Patch
            </button>
          </div>
        </label>
        <label>
          <span>Diff review</span>
          <textarea value={diff} onChange={event => setDiff(event.target.value)} rows={3} />
          <button type="button" onClick={() => run(() => reviewCodeDiff(diff))} disabled={loading || !diff.trim()}>
            Review Diff
          </button>
        </label>
      </div>

      {error && <div className="code-workflow-error">{error}</div>}
      {output && <pre className="code-workflow-output">{output}</pre>}
    </section>
  );
}

export default CodeWorkflowPanel;
