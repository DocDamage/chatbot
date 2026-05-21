import { useEffect, useMemo, useState } from 'react';
import {
  extractSpritePalette,
  generateSpriteManifest,
  getSpriteLabStatus,
  planExternalSpriteRun,
  planSpriteWorkflow,
  runExternalSpriteTool,
  sliceSpriteGrid,
  ExternalSpriteBackend,
  SpriteLabStatus,
  SpriteWorkflow,
  SpriteWorkflowPlan
} from '../api/spriteLab';

const workflows: Array<{ value: SpriteWorkflow; label: string }> = [
  { value: 'spritesheet_export', label: 'Spritesheet export' },
  { value: 'frame_slice', label: 'Frame slice' },
  { value: 'palette_extract', label: 'Palette extract' },
  { value: 'manifest_generate', label: 'Manifest generate' }
];

const externalBackends: Array<{ value: ExternalSpriteBackend; label: string }> = [
  { value: 'aseprite', label: 'Aseprite' },
  { value: 'libresprite', label: 'LibreSprite' },
  { value: 'pixelorama', label: 'Pixelorama' }
];

export default function SpriteLabPanel() {
  const [status, setStatus] = useState<SpriteLabStatus | null>(null);
  const [workflow, setWorkflow] = useState<SpriteWorkflow>('spritesheet_export');
  const [externalBackend, setExternalBackend] = useState<ExternalSpriteBackend>('aseprite');
  const [inputPath, setInputPath] = useState('');
  const [outputTarget, setOutputTarget] = useState('');
  const [frameWidth, setFrameWidth] = useState(16);
  const [frameHeight, setFrameHeight] = useState(16);
  const [maxColors, setMaxColors] = useState(256);
  const [animationName, setAnimationName] = useState('default');
  const [plan, setPlan] = useState<SpriteWorkflowPlan | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const baseName = useMemo(() => {
    const name = inputPath.split(/[\\/]/).pop() || 'sprite';
    return name.replace(/\.[^.]+$/, '') || 'sprite';
  }, [inputPath]);

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

  const requireInputPath = () => {
    if (!inputPath.trim()) {
      setError('Input path is required');
      return false;
    }
    return true;
  };

  const runAction = async (label: string, action: () => Promise<any>) => {
    if (!requireInputPath()) return;
    try {
      setLoading(true);
      setError('');
      setActionResult(await action());
    } catch (err: any) {
      setError(err.message || `${label} failed`);
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async () => {
    if (!requireInputPath()) return;
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

  const externalWorkflow = () => {
    if (workflow === 'palette_extract') {
      throw new Error('External CLI palette extraction is not wired. Use the internal Extract Palette button.');
    }
    return workflow;
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
          External backend
          <select value={externalBackend} onChange={event => setExternalBackend(event.target.value as ExternalSpriteBackend)}>
            {externalBackends.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
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
        <label className="assistant-field">
          Frame width
          <input type="number" min="1" value={frameWidth} onChange={event => setFrameWidth(Number(event.target.value))} />
        </label>
        <label className="assistant-field">
          Frame height
          <input type="number" min="1" value={frameHeight} onChange={event => setFrameHeight(Number(event.target.value))} />
        </label>
        <label className="assistant-field">
          Max palette colors
          <input type="number" min="1" max="1024" value={maxColors} onChange={event => setMaxColors(Number(event.target.value))} />
        </label>
        <label className="assistant-field">
          Animation name
          <input value={animationName} onChange={event => setAnimationName(event.target.value)} placeholder="idle" />
        </label>

        <div className="sprite-lab-action-row">
          <button type="button" onClick={createPlan} disabled={loading}>{loading ? 'Working…' : 'Plan Workflow'}</button>
          <button type="button" onClick={() => runAction('Slice grid', () => sliceSpriteGrid({
            inputPath,
            outputDir: outputTarget.trim() || `data/sprite-lab/${baseName}/frames`,
            frameWidth,
            frameHeight
          }))} disabled={loading}>Slice Grid</button>
          <button type="button" onClick={() => runAction('Extract palette', () => extractSpritePalette({
            inputPath,
            outputPath: outputTarget.trim() || `data/sprite-lab/${baseName}.palette.json`,
            maxColors
          }))} disabled={loading}>Extract Palette</button>
          <button type="button" onClick={() => runAction('Generate manifest', () => generateSpriteManifest({
            inputPath,
            outputPath: outputTarget.trim() || `data/sprite-lab/${baseName}.manifest.json`,
            frameWidth,
            frameHeight,
            animationName: animationName.trim() || 'default'
          }))} disabled={loading}>Generate Manifest</button>
          <button type="button" onClick={() => runAction('Plan external CLI', () => planExternalSpriteRun({
            backend: externalBackend,
            workflow: externalWorkflow(),
            inputPath,
            outputTarget: outputTarget.trim() || undefined
          }))} disabled={loading}>Plan External CLI</button>
          <button type="button" onClick={() => runAction('Run approved external CLI', () => runExternalSpriteTool({
            backend: externalBackend,
            workflow: externalWorkflow(),
            inputPath,
            outputTarget: outputTarget.trim() || undefined,
            approvedByUser: true
          }))} disabled={loading}>Run Approved External CLI</button>
        </div>
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

      {actionResult && (
        <div className="sprite-plan-card">
          <h4>Action result</h4>
          <pre>{JSON.stringify(actionResult, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
