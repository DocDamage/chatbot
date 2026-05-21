import { useEffect, useState } from 'react';
import { getSpriteLabStatus, planSpriteWorkflow, SpriteLabStatus, SpriteWorkflow, SpriteWorkflowPlan } from '../api/spriteLab';

const workflows: Array<{ value: SpriteWorkflow; label: string }> = [
  { value: 'spritesheet_export', label: 'Spritesheet export' },
  { value: 'frame_slice', label: 'Frame slice' },
  { value: 'palette_extract', label: 'Palette extract' },
  { value: 'manifest_generate', label: 'Manifest generate' }
];

export default function SpriteLabPanel() {
  const [status, setStatus] = useState<SpriteLabStatus | null>(null);
  const [workflow, setWorkflow] = useState<SpriteWorkflow>('spritesheet_export');
  const [inputPath, setInputPath] = useState('');
  const [outputTarget, setOutputTarget] = useState('');
  const [plan, setPlan] = useState<SpriteWorkflowPlan | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshStatus = async () => {
    try {
      setError('');
      setStatus(await getSpriteLabStatus());
    } catch (err: any) {
      setError(err.message || 'Unable to load Sprite Lab status');
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const createPlan = async () => {
    if (!inputPath.trim()) {
      setError('Input path is required');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setPlan(await planSpriteWorkflow({
        workflow,
        inputPath,
        outputTarget: outputTarget.trim() || undefined
      }));
    } catch (err: any) {
      setError(err.message || 'Unable to plan Sprite Lab workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="assistant-panel sprite-lab-panel" aria-label="Sprite Lab">
      <div className="assistant-panel-header">
        <div>
          <h3>Sprite Lab</h3>
          <p>Aseprite-first sprite workflows with LibreSprite, Pixelorama, Sharp, and Python fallbacks.</p>
        </div>
        <button type="button" onClick={refreshStatus}>Refresh</button>
      </div>

      {error && <div className="assistant-error-bar" role="alert">{error}</div>}

      {status && (
        <div className="sprite-backend-grid">
          {status.backends.map(backend => (
            <div key={backend.slug} className={`sprite-backend-card ${backend.available ? 'available' : 'missing'}`}>
              <strong>{backend.label}</strong>
              <span>{backend.role}</span>
              <p>{backend.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="sprite-lab-form">
        <label className="assistant-field">
          Workflow
          <select value={workflow} onChange={event => setWorkflow(event.target.value as SpriteWorkflow)}>
            {workflows.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="assistant-field">
          Input path
          <input value={inputPath} onChange={event => setInputPath(event.target.value)} placeholder="assets/sprites/hero.aseprite" />
        </label>
        <label className="assistant-field">
          Output target
          <input value={outputTarget} onChange={event => setOutputTarget(event.target.value)} placeholder="optional; defaults to data/sprite-lab/..." />
        </label>
        <button type="button" onClick={createPlan} disabled={loading}>{loading ? 'Planning…' : 'Plan Sprite Workflow'}</button>
      </div>

      {plan && (
        <div className="sprite-plan-card">
          <h4>Planned workflow</h4>
          <p><strong>Backend:</strong> {plan.selectedBackend.label}</p>
          <p><strong>Input:</strong> {plan.inputPath}</p>
          <p><strong>Output:</strong> {plan.outputTarget}</p>
          <ul>
            {plan.notes.map(note => <li key={note}>{note}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
