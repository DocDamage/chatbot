import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/http';
import { applyStructuredCodePatch, repairCode, StructuredCodeOperation, verifyNativeCode } from '../api/code';
import { ChatMode } from './ModeSelector';
import './CodingToolsPanel.css';

interface Status { enabled: boolean; installed: Record<string, boolean>; model: string; workspaceRoot: string }
interface Patch { operations: StructuredCodeOperation[]; diff: string; conflicts: { path: string; reason: string }[]; applied?: boolean }
interface Selection { files: { path: string; role: string; reason: string }[]; omitted: number; limitations: string[] }
interface DraftCheckSummary { compiler?: { status: string; baselineErrors: number }; linter?: { status: string; baselineErrors: number } }
const paths = (text: string) => text.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
async function request<T>(route: string, input?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(`/api/code/tools/${route}`, input === undefined ? { signal } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || result.message || 'Coding tool request failed.');
  return result;
}

export default function CodingToolsPanel({ mode }: { mode: ChatMode }) {
  const [open, setOpen] = useState(false), [status, setStatus] = useState<Status | null>(null);
  const [tab, setTab] = useState('code'), [files, setFiles] = useState(''), [newFiles, setNewFiles] = useState('');
  const [task, setTask] = useState(''), [symbol, setSymbol] = useState(''), [definition, setDefinition] = useState('');
  const [pattern, setPattern] = useState(''), [rewrite, setRewrite] = useState(''), [rewriteEnabled, setRewriteEnabled] = useState(false);
  const [language, setLanguage] = useState('typescript'), [library, setLibrary] = useState(''), [question, setQuestion] = useState('');
  const [useDocs, setUseDocs] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [automaticContext, setAutomaticContext] = useState(true), [propertyTests, setPropertyTests] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null), [checks, setChecks] = useState<DraftCheckSummary | null>(null);
  const [cancellable, setCancellable] = useState(true);
  const [output, setOutput] = useState(''), [patch, setPatch] = useState<Patch | null>(null), [applied, setApplied] = useState(false);
  const [verification, setVerification] = useState('not_run');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void request<Status>('status').then(value => { if (active) setStatus(value); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [open]);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async (action: (signal: AbortSignal) => Promise<any>, canCancel = true) => {
    setCancellable(canCancel);
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('');
    try {
      const result = await action(controller.signal);
      if (result.patch) { setPatch(result.patch); setApplied(false); setVerification('not_run'); setSelection(result.selection || null); setChecks(result.draftChecks || null); }
      setOutput(result.content || (result.references ? `Definition:\n${result.definition.content}\n\nReferencing symbols:\n${result.references.content}` : JSON.stringify(result, null, 2)));
    } catch (failure) { setError((failure as Error).name === 'AbortError' ? 'Coding request cancelled.' : (failure as Error).message); }
    finally { setBusy(false); abort.current = null; }
  };
  const execute = () => run(signal => {
    const selected = paths(files);
    if (tab === 'references') return request('references', { files: selected, file: definition || selected[0], symbol }, signal);
    if (tab === 'structural') return request('structural', { files: selected, pattern, language, rewrite: rewriteEnabled ? rewrite : undefined }, signal);
    if (tab === 'docs') return request('documentation', { library, query: question }, signal);
    return request('propose', { files: selected, newFiles: paths(newFiles), message: task,
      automaticContext, propertyTests,
      documentation: useDocs ? { library, query: question } : undefined }, signal);
  });
  const apply = () => run(async () => {
    if (!patch) return {};
    const result = await applyStructuredCodePatch(patch.operations, mode); setApplied(true); return result;
  }, false);
  return <div className="coding-tools">
    <button type="button" aria-expanded={open} aria-controls="coding-tools-workspace" onClick={() => setOpen(!open)}>Coding workspace</button>
    {open && <section id="coding-tools-workspace" aria-label="Coding integrations" tabIndex={0}>
      <h2>Code with local Ollama</h2>
      <p>Inspect references, search code patterns, look up documentation and draft changes for review.</p>
      {status && <><p className="coding-tools-hint">Repository: {status.workspaceRoot} · Model: {status.model}</p>
        <p>{Object.entries(status.installed).map(([name, installed]) => `${name}: ${installed ? 'installed' : 'needs setup'}`).join(' · ')}</p>
        {!status.enabled && <p>Run npm run setup:coding-tools and restart to enable these integrations.</p>}</>}
      <label htmlFor="coding-tools-action">Action</label>
      <select id="coding-tools-action" value={tab} onChange={event => setTab(event.target.value)} disabled={busy}>
        <option value="code">Draft changes with Aider</option><option value="references">Find referencing symbols with Serena</option>
        <option value="structural">Search / rewrite with ast-grep</option><option value="docs">Look up documentation with Context7</option>
      </select>
      <form onSubmit={event => { event.preventDefault(); void execute(); }}>
        {tab !== 'docs' && <><label htmlFor="coding-tools-files">Existing source files (one repository-relative path per line)</label>
          <textarea id="coding-tools-files" value={files} onChange={event => setFiles(event.target.value)} rows={3} placeholder={'src/example.ts\nsrc/example.test.ts'} />
          <p className="coding-tools-hint">Aider accepts up to 12 captured files and 16 KB of source, including supporting context.</p></>}
        {tab === 'code' && <><label htmlFor="coding-tools-new-files">New files to create (optional, one path per line)</label>
          <textarea id="coding-tools-new-files" value={newFiles} onChange={event => setNewFiles(event.target.value)} rows={2} />
          <label htmlFor="coding-tools-task">Coding task and acceptance criteria</label>
          <textarea id="coding-tools-task" value={task} onChange={event => setTask(event.target.value)} rows={3} required />
          <label className="coding-tools-check"><input type="checkbox" checked={automaticContext} onChange={event => setAutomaticContext(event.target.checked)} />Automatically find supporting files</label>
          <p className="coding-tools-hint">Imports, callers and related tests are read-only context. Leave existing files empty to select implementation files from a task naming a file or symbol. Review the selected scope with the patch.</p>
          <label className="coding-tools-check"><input type="checkbox" checked={propertyTests} onChange={event => setPropertyTests(event.target.checked)} />Include fast-check property test guidance</label>
          {propertyTests && <p className="coding-tools-hint">The target project needs fast-check installed as a development dependency. Drafting does not install dependencies or execute tests.</p>}
          <label className="coding-tools-check"><input type="checkbox" checked={useDocs} onChange={event => setUseDocs(event.target.checked)} />Include a Context7 documentation lookup</label></>}
        {tab === 'references' && <><label htmlFor="coding-tools-definition">Definition file (defaults to the first selected file)</label>
          <input id="coding-tools-definition" value={definition} onChange={event => setDefinition(event.target.value)} />
          <label htmlFor="coding-tools-symbol">Symbol name or name path</label><input id="coding-tools-symbol" value={symbol} onChange={event => setSymbol(event.target.value)} required />
          <p className="coding-tools-hint">Select the definition file and files that may reference it. Serena returns referencing symbols within this snapshot.</p></>}
        {tab === 'structural' && <><label htmlFor="coding-tools-language">Language</label>
          <select id="coding-tools-language" value={language} onChange={event => setLanguage(event.target.value)}>
            {['typescript', 'tsx', 'javascript', 'jsx', 'python', 'rust', 'go', 'java', 'c', 'cpp', 'csharp'].map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label htmlFor="coding-tools-pattern">Structural pattern</label><input id="coding-tools-pattern" value={pattern} onChange={event => setPattern(event.target.value)} placeholder="$OBJECT.oldMethod($$$ARGS)" required />
          <label className="coding-tools-check"><input type="checkbox" checked={rewriteEnabled} onChange={event => setRewriteEnabled(event.target.checked)} />Preview a replacement</label>
          {rewriteEnabled && <><label htmlFor="coding-tools-rewrite">Replacement pattern</label><input id="coding-tools-rewrite" value={rewrite} onChange={event => setRewrite(event.target.value)} /></>}
        </>}
        {(tab === 'docs' || tab === 'code' && useDocs) && <><p>Context7 sends this documentation question to its external service. Keep private code and secrets out of it.</p>
          <label htmlFor="coding-tools-library">Library name or Context7 library ID</label><input id="coding-tools-library" value={library} onChange={event => setLibrary(event.target.value)} placeholder="/microsoft/typescript" required />
          <label htmlFor="coding-tools-question">Documentation question</label><textarea id="coding-tools-question" value={question} onChange={event => setQuestion(event.target.value)} rows={2} required />
          <p className="coding-tools-hint">Search by library name first, then use a returned /owner/library ID to retrieve documentation.</p></>}
        <button type="submit" disabled={busy || !status?.enabled}>{tab === 'code' ? 'Draft changes' : tab === 'structural' ? 'Inspect code pattern' : tab === 'references' ? 'Find references' : 'Fetch documentation'}</button>
      </form>
      {busy && <><p role="status">Working… local coding tasks can take several minutes.</p>{cancellable && <button type="button" onClick={() => abort.current?.abort()}>Cancel coding request</button>}</>}
      {error && <p role="alert">{error}</p>}
      {patch && <article aria-label="Proposed code changes"><h3>Review proposed changes</h3>
        <p>{patch.operations.length} file change(s). {applied ? verification === 'not_run' ? 'Applied; verification is still required.' : `Applied; verification ${verification}.` : 'Repository files have not been changed.'}</p>
        {selection && <details><summary>Files selected for this draft</summary><ul>{selection.files.map(file => <li key={file.path}>{file.path} · {file.role === 'editable' ? 'editable' : 'read-only context'} · {file.reason}</li>)}</ul>
          <p>{selection.omitted} candidate(s) omitted by scan or context limits. {selection.limitations.join(' ')}</p></details>}
        {checks && <p className="coding-tools-hint">Compiler comparison: {checks.compiler?.status || 'not run'} · Linter comparison: {checks.linter?.status || 'not run'}. Baseline snapshot diagnostics: {checks.compiler?.baselineErrors || 0} compiler, {checks.linter?.baselineErrors || 0} lint. Full project verification is separate.</p>}
        {patch.conflicts.length > 0 && <p role="alert">{patch.conflicts.map(item => `${item.path}: ${item.reason}`).join('; ')}</p>}
        <pre tabIndex={0} aria-label="Proposed diff">{patch.diff}</pre>
        <button type="button" disabled={busy || applied || mode !== 'implement' || !patch.operations.length || !!patch.conflicts.length} onClick={() => void apply()}>Apply reviewed patch</button>
        {mode !== 'implement' && <p className="coding-tools-hint">Switch to Build mode to apply the reviewed patch.</p>}
        <button type="button" disabled={busy || !applied || !['implement', 'debug'].includes(mode)} onClick={() => void run(async () => { const result = await verifyNativeCode(mode); setVerification(result.status); return result; }, false)}>Verify applied changes</button>
        <button type="button" disabled={busy || !patch.operations.length || mode !== 'debug'} onClick={() => void run(async () => {
          const result = await repairCode(patch.operations, mode, 3, applied, useDocs ? { library, query: question } : undefined, { contextFiles: selection ? selection.files.map(file => file.path) : paths(files), message: task }); if (result.attempts?.length) setApplied(true); setVerification(result.status); return result;
        }, false)}>Repair approved files and verify</button>
      </article>}
      {output && <details><summary>Tool results and verification</summary><pre tabIndex={0} aria-label="Coding tool output">{output}</pre></details>}
    </section>}
  </div>;
}
