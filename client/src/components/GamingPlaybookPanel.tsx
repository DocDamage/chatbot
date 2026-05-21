import { useState } from 'react';
import { createGamingPlaybook, GamingPlaybookKind, GamingPlaybookResult } from '../api/gaming';
import './GamingPlaybookPanel.css';

const playbookOptions: Array<{ kind: GamingPlaybookKind; label: string }> = [
  { kind: 'engine_selection', label: 'Engine' },
  { kind: 'asset_pipeline', label: 'Assets' },
  { kind: 'design_review', label: 'Design' },
  { kind: 'modding_safety', label: 'Modding' },
  { kind: 'prompt_pack', label: 'Prompts' }
];

function GamingPlaybookPanel() {
  const [kind, setKind] = useState<GamingPlaybookKind>('design_review');
  const [goal, setGoal] = useState('');
  const [engine, setEngine] = useState('');
  const [genre, setGenre] = useState('');
  const [targetPlatform, setTargetPlatform] = useState('');
  const [result, setResult] = useState<GamingPlaybookResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!goal.trim()) {
      setError('Goal is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setResult(await createGamingPlaybook({
        kind,
        goal,
        engine: engine.trim() || undefined,
        genre: genre.trim() || undefined,
        targetPlatform: targetPlatform.trim() || undefined
      }));
    } catch (err: any) {
      setError(err.message || 'Gaming playbook failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="gaming-playbook-panel" aria-label="Gaming playbooks">
      <div className="gaming-playbook-header">
        <strong>Gaming Playbooks</strong>
        <span>Engine, assets, design, modding, prompts</span>
      </div>

      <div className="gaming-playbook-controls">
        <select value={kind} onChange={event => setKind(event.target.value as GamingPlaybookKind)}>
          {playbookOptions.map(option => <option key={option.kind} value={option.kind}>{option.label}</option>)}
        </select>
        <input value={goal} onChange={event => setGoal(event.target.value)} placeholder="Goal, problem, or game idea" />
        <input value={engine} onChange={event => setEngine(event.target.value)} placeholder="Engine/tool optional" />
        <input value={genre} onChange={event => setGenre(event.target.value)} placeholder="Genre optional" />
        <input value={targetPlatform} onChange={event => setTargetPlatform(event.target.value)} placeholder="Target platform optional" />
        <button type="button" onClick={submit} disabled={loading || !goal.trim()}>{loading ? 'Working...' : 'Create Playbook'}</button>
      </div>

      {error && <div className="gaming-playbook-error">{error}</div>}

      {result && (
        <div className="gaming-playbook-result">
          <h4>{result.title}</h4>
          <PlaybookList title="Recommendations" items={result.recommendations} />
          <PlaybookList title="Checklist" items={result.checklist} />
          <PlaybookList title="Risks" items={result.risks} />
          <PlaybookList title="Follow-up" items={result.followUpQuestions} />
        </div>
      )}
    </section>
  );
}

function PlaybookList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="gaming-playbook-list">
      <strong>{title}</strong>
      <ul>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export default GamingPlaybookPanel;
