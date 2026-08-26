import { useEffect, useMemo, useState } from 'react';
import './ExpansionStudiosPanel.css';

type StudioId = 'context_economy' | 'agent_operations' | 'game_engine_bridge' | 'sprite_studio' |
  'stem_mix_lab' | 'media_accessibility' | 'writing_studio' | 'study_studio';

interface StudioDefinition {
  id: StudioId;
  label: string;
  description: string;
  checkPath: string;
}

const studios: StudioDefinition[] = [
  { id: 'context_economy', label: 'Context Economy', description: 'Compress context while preserving reversible source evidence.', checkPath: '/api/context-economy/proposals' },
  { id: 'agent_operations', label: 'Agent Operations', description: 'Inspect managed sessions, budgets, claims, and stop controls.', checkPath: '/api/agent-operations/summary' },
  { id: 'game_engine_bridge', label: 'Game Studio', description: 'Inspect configured Godot, Unity, and Unreal adapter profiles.', checkPath: '/api/game-studio/summary' },
  { id: 'sprite_studio', label: 'Sprite Studio', description: 'Discover local image-pipeline presets and palette tools.', checkPath: '/api/sprite-studio/presets' },
  { id: 'stem_mix_lab', label: 'Music Studio', description: 'Probe local stem-separation and audio-analysis hardware.', checkPath: '/api/music-studio/hardware-probe' },
  { id: 'media_accessibility', label: 'Media Accessibility', description: 'Subtitle, narration, read-along, and consent-gated dubbing workflows.', checkPath: '/api/media-accessibility/status' },
  { id: 'writing_studio', label: 'Writing Studio', description: 'Open, revise, proofread, and save a local document.', checkPath: '/api/writing-studio/state' },
  { id: 'study_studio', label: 'Study Studio', description: 'Build source-grounded notes, flashcards, quizzes, and study plans.', checkPath: '/api/study-studio/state' }
];

function authHeaders(json = false): Record<string, string> {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('jwt');
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export default function ExpansionStudiosPanel({ initialCapabilityId }: { initialCapabilityId?: string }) {
  const initial = studios.some(item => item.id === initialCapabilityId) ? initialCapabilityId as StudioId : 'context_economy';
  const [selected, setSelected] = useState<StudioId>(initial);
  const [title, setTitle] = useState('Untitled workspace');
  const [subject, setSubject] = useState('General study');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [status, setStatus] = useState('Choose a studio, then run a safe local action.');
  const [busy, setBusy] = useState(false);
  const definition = useMemo(() => studios.find(item => item.id === selected)!, [selected]);

  useEffect(() => {
    if (studios.some(item => item.id === initialCapabilityId)) setSelected(initialCapabilityId as StudioId);
  }, [initialCapabilityId]);

  async function request(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown) {
    setBusy(true);
    setStatus(`Running ${definition.label} action…`);
    try {
      const response = await fetch(path, {
        method,
        headers: authHeaders(body !== undefined),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setResult(payload);
      setStatus(`${definition.label} action completed locally.`);
      return payload;
    } catch (error) {
      setResult(null);
      setStatus(`${definition.label} unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runPrimaryAction() {
    if (selected === 'context_economy') return request('/api/context-economy/compress', 'POST', { text: content, filename: title });
    if (selected === 'agent_operations') return request('/api/agent-operations/sessions', 'POST', { agentId: title, projectId: subject, role: 'implementer', readOnly: true });
    if (selected === 'writing_studio') return request('/api/writing-studio/documents/open', 'POST', { title, content });
    if (selected === 'study_studio') return request('/api/study-studio/collections', 'POST', { title, subject, targetLevel: 'intermediate', learningGoals: [] });
    return request(definition.checkPath);
  }

  async function runSecondaryAction(action: 'proofread' | 'save' | 'add_source' | 'notes' | 'flashcards' | 'quiz' | 'plan') {
    const actions = {
      proofread: ['/api/writing-studio/proofread', 'POST', {}],
      save: ['/api/writing-studio/save', 'POST', { commitMessage: 'Saved from Expansion Studios' }],
      add_source: ['/api/study-studio/sources', 'POST', { title, content, format: 'markdown' }],
      notes: ['/api/study-studio/notes', 'POST', { noteType: 'outline' }],
      flashcards: ['/api/study-studio/flashcards/generate', 'POST', {}],
      quiz: ['/api/study-studio/quizzes/generate', 'POST', {}],
      plan: ['/api/study-studio/plan', 'POST', { dailyMinutes: 45 }]
    } as const;
    const [path, method, body] = actions[action];
    return request(path, method, body);
  }

  const needsContent = selected === 'context_economy' || selected === 'writing_studio' || selected === 'study_studio';

  return (
    <section className="expansion-studios" aria-label="Expansion Studios workspace">
      <header>
        <span className="advanced-workspace-eyebrow">Profile expansion</span>
        <h3>Expansion Studios</h3>
        <p>Use the added capability services directly from the app. Mutating or external operations remain behind their server-side approval and policy gates.</p>
      </header>
      <div className="expansion-studio-tabs" role="tablist" aria-label="Expansion studios">
        {studios.map(studio => (
          <button key={studio.id} type="button" role="tab" aria-selected={selected === studio.id} onClick={() => { setSelected(studio.id); setResult(null); }}>
            {studio.label}
          </button>
        ))}
      </div>
      <div className="expansion-studio-body">
        <div className="expansion-studio-form">
          <h4>{definition.label}</h4>
          <p>{definition.description}</p>
          {(selected === 'agent_operations' || needsContent) && (
            <label>Title or agent name<input value={title} maxLength={200} onChange={event => setTitle(event.target.value)} /></label>
          )}
          {(selected === 'agent_operations' || selected === 'study_studio') && (
            <label>Project or subject<input value={subject} maxLength={300} onChange={event => setSubject(event.target.value)} /></label>
          )}
          {needsContent && (
            <label>Content<textarea value={content} maxLength={2 * 1024 * 1024} onChange={event => setContent(event.target.value)} placeholder="Paste local content for this workspace…" /></label>
          )}
          <div className="expansion-studio-actions">
            <button type="button" disabled={busy || (needsContent && !content.trim())} onClick={() => void runPrimaryAction()}>
              {selected === 'context_economy' ? 'Compress context' : selected === 'agent_operations' ? 'Register read-only session' : selected === 'writing_studio' ? 'Open document' : selected === 'study_studio' ? 'Create collection' : 'Check capability'}
            </button>
            <button type="button" disabled={busy} onClick={() => void request(definition.checkPath)}>Refresh status</button>
          </div>
          {selected === 'writing_studio' && <div className="expansion-studio-actions">
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('proofread')}>Proofread</button>
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('save')}>Save snapshot</button>
          </div>}
          {selected === 'study_studio' && <div className="expansion-studio-actions">
            <button type="button" disabled={busy || !content.trim()} onClick={() => void runSecondaryAction('add_source')}>Add source</button>
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('notes')}>Generate notes</button>
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('flashcards')}>Flashcards</button>
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('quiz')}>Quiz</button>
            <button type="button" disabled={busy} onClick={() => void runSecondaryAction('plan')}>Study plan</button>
          </div>}
        </div>
        <div className="expansion-studio-output" aria-live="polite">
          <strong>Status</strong><p>{status}</p>
          <pre>{result ? JSON.stringify(result, null, 2) : 'No result yet.'}</pre>
        </div>
      </div>
    </section>
  );
}
