import { useMemo, useState } from 'react';

type Utility = 'json' | 'regex' | 'markdown' | 'encoding';

export default function UtilityWorkbenchPanel() {
  const [open, setOpen] = useState(false);
  const [utility, setUtility] = useState<Utility>('json');
  const [input, setInput] = useState('');
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('gi');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const description = useMemo(() => ({
    json: 'Format, minify, and validate JSON.',
    regex: 'Test a regular expression against text.',
    markdown: 'Inspect Markdown structure and word count.',
    encoding: 'Encode or decode Base64 and URL text.'
  }[utility]), [utility]);

  const run = (action: string) => {
    setError('');
    try {
      if (utility === 'json') {
        const parsed = JSON.parse(input);
        setResult(action === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2));
      } else if (utility === 'regex') {
        const expression = new RegExp(pattern, flags);
        setResult(JSON.stringify([...input.matchAll(expression)].map(match => ({ match: match[0], index: match.index })), null, 2));
      } else if (utility === 'markdown') {
        const headings = input.split(/\r?\n/).filter(line => /^#{1,6}\s/.test(line)).length;
        const words = input.trim() ? input.trim().split(/\s+/).length : 0;
        setResult(`Words: ${words}\nHeadings: ${headings}\n\n${input}`);
      } else if (action === 'base64-encode') {
        setResult(window.btoa(unescape(encodeURIComponent(input))));
      } else if (action === 'base64-decode') {
        setResult(decodeURIComponent(escape(window.atob(input))));
      } else if (action === 'url-encode') {
        setResult(encodeURIComponent(input));
      } else {
        setResult(decodeURIComponent(input));
      }
    } catch (caught) {
      setResult('');
      setError(caught instanceof Error ? caught.message : 'Could not process this input.');
    }
  };

  return (
    <section className="workspace-panel utility-workbench-panel">
      <button type="button" className="workspace-panel-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <span>Curated utilities</span><span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="workspace-panel-body">
        <label>Utility<select value={utility} onChange={event => { setUtility(event.target.value as Utility); setResult(''); setError(''); }}>
          <option value="json">JSON</option><option value="regex">Regex</option><option value="markdown">Markdown</option><option value="encoding">Encoding</option>
        </select></label>
        <p className="workspace-help">{description}</p>
        {utility === 'regex' && <div className="workspace-inline-fields"><label>Pattern<input value={pattern} onChange={event => setPattern(event.target.value)} placeholder="error|warning" /></label><label>Flags<input value={flags} onChange={event => setFlags(event.target.value)} /></label></div>}
        <textarea value={input} onChange={event => setInput(event.target.value)} placeholder={utility === 'json' ? '{"name":"Chatbot"}' : 'Paste text here...'} />
        <div className="workspace-action-row">
          {utility === 'json' && <><button type="button" onClick={() => run('format')}>Format</button><button type="button" onClick={() => run('minify')}>Minify</button></>}
          {utility === 'regex' && <button type="button" onClick={() => run('test')}>Test matches</button>}
          {utility === 'markdown' && <button type="button" onClick={() => run('inspect')}>Inspect</button>}
          {utility === 'encoding' && <><button type="button" onClick={() => run('base64-encode')}>Base64 encode</button><button type="button" onClick={() => run('base64-decode')}>Base64 decode</button><button type="button" onClick={() => run('url-encode')}>URL encode</button><button type="button" onClick={() => run('url-decode')}>URL decode</button></>}
        </div>
        {error && <p className="workspace-error">{error}</p>}
        {result && <pre className="workspace-result">{result}</pre>}
      </div>}
    </section>
  );
}
