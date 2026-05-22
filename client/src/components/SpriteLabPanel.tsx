import { useEffect, useMemo, useState } from 'react';
import FileExplorerPanel from './FileExplorerPanel';
import {
  approveLocalToolRun,
  extractSpritePalette,
  generateSpriteManifest,
  getSpriteLabStatus,
  listSpriteExternalRunFiles,
  planExternalSpriteRun,
  planSpriteWorkflow,
  sliceSpriteGrid,
  spriteExternalRunFileUrl,
  startLocalToolRun,
  ExternalSpriteBackend,
  PlannedExternalSpriteRun,
  SpriteBackendStatus,
  SpriteLabStatus,
  SpriteWorkflow,
  SpriteWorkflowPlan
} from '../api/spriteLab';
import { LocalRunOutputFile } from '../api/localRunApprovals';

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
  const [plannedExternalRun, setPlannedExternalRun] = useState<PlannedExternalSpriteRun | null>(null);
  const [externalRunFiles, setExternalRunFiles] = useState<LocalRunOutputFile[]>([]);
  const [actionResult, setActionResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const baseName = useMemo(() => {
    const name = inputPath.split(/[\\/]/).pop() || 'sprite';
    return name.replace(/\.[^.]+$/, '') || 'sprite';
  }, [inputPath]);

  const selectedExternalStatus = useMemo(() => {
    return status?.backends.find(backend => backend.slug === externalBackend) || null;
  }, [status, externalBackend]);

  const refreshStatus = async () => {
    try {
      setError('');
      setStatus(await getSpriteLabStatus());
    } catch (err: any) {
      setError(friendlySpriteError(err, 'Unable to load Sprite Lab status'));
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  const requireInputPath = () => {
    if (!inputPath.trim()) {
      setError('Input path is required. Pick a sprite file from the explorer or paste a workspace-relative path.');
      return false;
    }
    return true;
  };

  const runAction = async (label: string, action: () => Promise<any>, needsInputPath = true) => {
    if (needsInputPath && !requireInputPath()) return;
    try {
      setLoading(true);
      setError('');
      setActionResult(await action());
    } catch (err: any) {
      setError(friendlySpriteError(err, `${label} failed`));
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
      setError(friendlySpriteError(err, 'Unable to plan Sprite Lab workflow'));
    } finally {
      setLoading(false);
    }
  };

  const planExternal = async () => {
    if (selectedExternalStatus && !selectedExternalStatus.available) {
      throw new Error(`${selectedExternalStatus.label} is not detected. Register or enable the executable in Local Tools first.`);
    }
    const result = await planExternalSpriteRun({
      backend: externalBackend,
      workflow,
      inputPath,
      outputTarget: outputTarget.trim() || undefined
    });
    setPlannedExternalRun(result);
    setExternalRunFiles([]);
    return result;
  };

  const approveExternal = async () => {
    if (!plannedExternalRun?.runId) throw new Error('No planned external run');
    const result = await approveLocalToolRun(plannedExternalRun.runId);
    setPlannedExternalRun(prev => prev ? { ...prev, status: result.run?.status || prev.status } : prev);
    return result;
  };

  const startExternal = async () => {
    if (!plannedExternalRun?.runId) throw new Error('No planned external run');
    const result = await startLocalToolRun(plannedExternalRun.runId);
    setPlannedExternalRun(prev => prev ? { ...prev, status: result.run?.status || result.status || prev.status } : prev);
    await refreshExternalRunFiles(plannedExternalRun.runId);
    return result;
  };

  const refreshExternalRunFiles = async (runId = plannedExternalRun?.runId) => {
    if (!runId) return;
    const result = await listSpriteExternalRunFiles(runId);
    setExternalRunFiles(result.files);
  };

  const copy = async (value: string) => {
    if (!value.trim()) return;
    await navigator.clipboard?.writeText(value);
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
            <BackendCard key={backend.slug} backend={backend} selected={backend.slug === status.selected.slug || backend.slug === externalBackend} />
          ))}
        </div>
      )}

      <FileExplorerPanel
        mode="select"
        accept={['.png', '.ase', '.aseprite']}
        onSelect={(file) => setInputPath(file.path)}
      />

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
          {selectedExternalStatus && (
            <span className={`sprite-backend-inline ${selectedExternalStatus.available ? 'available' : 'missing'}`}>
              {selectedExternalStatus.available ? 'Detected and available' : 'Missing or disabled'} · {selectedExternalStatus.detail}
            </span>
          )}
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
          <button type="button" onClick={() => runAction('Plan external CLI', planExternal)} disabled={loading}>Plan External CLI</button>
          <button type="button" onClick={() => runAction('Approve external CLI', approveExternal, false)} disabled={loading || !plannedExternalRun?.runId}>Approve Planned CLI</button>
          <button type="button" onClick={() => runAction('Start external CLI', startExternal, false)} disabled={loading || !plannedExternalRun?.runId}>Start Approved CLI</button>
        </div>
      </div>

      {plannedExternalRun?.runId && (
        <div className="sprite-plan-card sprite-external-run-card">
          <div className="sprite-card-header-row">
            <h4>External run</h4>
            <span className={`status-pill status-${plannedExternalRun.status.replace(/_/g, '-')}`}>{plannedExternalRun.status}</span>
          </div>
          <p><strong>Run ID:</strong> {plannedExternalRun.runId}</p>
          <p><strong>Backend:</strong> {plannedExternalRun.adapter?.backend || externalBackend}</p>
          <p><strong>Workflow:</strong> {plannedExternalRun.adapter?.workflow || workflow}</p>
          {plannedExternalRun.resolvedCommand && <code className="sprite-command-preview">{plannedExternalRun.resolvedCommand.join(' ')}</code>}
          <div className="sprite-lab-action-row">
            <button type="button" onClick={() => copy(plannedExternalRun.resolvedCommand?.join(' ') || plannedExternalRun.commandTemplate || '')}>Copy command</button>
            <button type="button" onClick={() => copy(plannedExternalRun.adapter?.outputTarget || '')} disabled={!plannedExternalRun.adapter?.outputTarget}>Copy output target</button>
            <button type="button" onClick={() => refreshExternalRunFiles()}>Refresh output files</button>
          </div>
          {plannedExternalRun.adapter?.outputFiles?.length ? (
            <ExpectedOutputList outputFiles={plannedExternalRun.adapter.outputFiles} />
          ) : null}
          <OutputLinkList runId={plannedExternalRun.runId} files={externalRunFiles} />
        </div>
      )}

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

      {actionResult && <ActionResultCard result={actionResult} />}
    </section>
  );
}

function BackendCard({ backend, selected }: { backend: SpriteBackendStatus; selected: boolean }) {
  return (
    <div className={`sprite-backend-card ${backend.available ? 'available' : 'missing'} ${selected ? 'selected' : ''}`}>
      <strong>{backend.label}</strong>
      <span>{backend.role} · {backend.available ? 'available' : 'missing'}</span>
      <p>{backend.detail}</p>
    </div>
  );
}

function ExpectedOutputList({ outputFiles }: { outputFiles: string[] }) {
  return (
    <div className="sprite-output-list">
      <strong>Expected outputs</strong>
      {outputFiles.map(file => <code key={file}>{file}</code>)}
    </div>
  );
}

function OutputLinkList({ runId, files }: { runId: string; files: LocalRunOutputFile[] }) {
  return (
    <div className="sprite-output-list">
      <strong>Captured run files</strong>
      {files.length === 0 && <span className="assistant-muted">No run output files captured yet. Start the run, then refresh output files.</span>}
      {files.map(file => (
        <a key={file.fileName} href={spriteExternalRunFileUrl(runId, file.fileName)} target="_blank" rel="noreferrer">
          {file.fileName} · {formatBytes(file.size)}
        </a>
      ))}
    </div>
  );
}

function ActionResultCard({ result }: { result: any }) {
  const outputCandidates = [
    result?.outputPath,
    result?.outputDir,
    result?.manifestPath,
    result?.palettePath,
    result?.sheetPath
  ].filter(Boolean);

  return (
    <div className="sprite-plan-card">
      <h4>Action result</h4>
      {result?.success !== undefined && <p><strong>Status:</strong> {result.success ? 'completed' : 'failed'}</p>}
      {outputCandidates.length > 0 && (
        <div className="sprite-output-list">
          <strong>Generated outputs</strong>
          {outputCandidates.map((file: string) => <code key={file}>{file}</code>)}
        </div>
      )}
      {!outputCandidates.length && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function friendlySpriteError(error: any, fallback: string): string {
  const message = error?.message || fallback;
  if (/not detected|not available|No enabled executable|executable/i.test(message)) {
    return `${message} Check Local Tools, register the executable, and make sure it is enabled before planning an external run.`;
  }
  if (/outside workspace|path resolves|blocked/i.test(message)) {
    return 'That path is blocked because it resolves outside the trusted workspace. Use a workspace-relative input/output path.';
  }
  if (/requires explicit user approval/i.test(message)) {
    return 'This external run needs approval first. Use Approve Planned CLI, then Start Approved CLI.';
  }
  return message;
}
