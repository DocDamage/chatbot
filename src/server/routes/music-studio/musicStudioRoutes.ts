/**
 * Music Studio API Routes (PX11-T10)
 *
 * REST API for audio rights preflight, stem separation jobs, waveform summaries,
 * multitrack mixer controls, track analysis, mixdown exports, and DAW routing handoffs.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { AudioJobRightsModel } from '../../../core/audio/stemdeck/AudioJobRightsModel';
import { DemucsWorkerAdapter } from '../../../core/audio/stemdeck/DemucsWorkerAdapter';
import { StemSeparationEngine } from '../../../core/audio/stemdeck/StemSeparationEngine';
import { WaveformMixerEngine } from '../../../core/audio/stemdeck/WaveformMixerEngine';
import { AudioTrackAnalyzer } from '../../../core/audio/stemdeck/AudioTrackAnalyzer';
import { AudioExportMixdownService } from '../../../core/audio/stemdeck/AudioExportMixdownService';
import { DAWIntegrationHandoff } from '../../../core/audio/stemdeck/DAWIntegrationHandoff';
import { AudioJobState, AudioRightsDeclaration, StemType } from '../../../core/audio/stemdeck/StemdeckTypes';
import { resolveWorkspacePath } from '../localPathGuard';
import { DemucsCliExecutor, discoverLocalRuntimes } from '../../../core/native-runtime';
import { LocalRuntimeInventory } from '../../../core/native-runtime/RuntimeDiscovery';

export function createMusicStudioRouter(
  workspaceRoot = process.cwd(),
  integrations: { autoDiscover?: boolean; runtimes?: LocalRuntimeInventory } = {}
): Router {
  const router = Router();
  const runtimes = integrations.runtimes || (integrations.autoDiscover === false
    ? { ollamaEndpoint: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434' }
    : discoverLocalRuntimes(workspaceRoot));
  const workerAdapter = new DemucsWorkerAdapter(
    runtimes.demucs && runtimes.ffmpeg && runtimes.ffprobe
      ? new DemucsCliExecutor(runtimes.demucs, runtimes.ffmpeg, runtimes.ffprobe)
      : undefined
  );
  const separationEngine = new StemSeparationEngine(workerAdapter);
  const activeJobs = new Map<string, AudioJobState>();

  // 1. Hardware Probe
  router.get('/api/music-studio/hardware-probe', asyncHandler(async (_req, res) => {
    const probe = await workerAdapter.probeHardwareAcceleration();
    res.json(probe);
  }));

  // 2. Rights Preflight
  router.post('/api/music-studio/preflight', asyncHandler(async (req, res) => {
    const { filePath, rights, requestedStems } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required.' });
    }

    const rightsDecl: AudioRightsDeclaration = rights || {
      hasExplicitUserConsent: false,
      declarationText: '',
      processingLocation: 'local_only',
      declaredAt: new Date().toISOString()
    };

    const safeFilePath = resolveWorkspacePath(workspaceRoot, filePath, { label: 'filePath', mustExist: true, kind: 'file' });
    const preflight = AudioJobRightsModel.preflightAudio(safeFilePath, rightsDecl, requestedStems);
    res.json(preflight);
  }));

  // 3. Start Stem Separation Job
  router.post('/api/music-studio/separate', asyncHandler(async (req, res) => {
    const { filePath, rights, requestedStems, modelName, generateBackingTrack } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required.' });
    }
    if (!workerAdapter.isAvailable()) {
      return res.status(503).json({ error: 'Stem separation is unavailable until a verified local Demucs worker is configured.' });
    }

    const safeFilePath = resolveWorkspacePath(workspaceRoot, filePath, { label: 'filePath', mustExist: true, kind: 'file' });
    const preflight = AudioJobRightsModel.preflightAudio(safeFilePath, rights, requestedStems);
    if (!preflight.valid) {
      return res.status(400).json({ error: preflight.error });
    }

    const jobId = `stemjob-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const jobState: AudioJobState = {
      jobId,
      sourcePath: safeFilePath,
      state: 'separating',
      stage: 'initiating_separation',
      progressPercentage: 5,
      requestedStems: requestedStems || ['vocals', 'drums', 'bass', 'other'],
      createdArtifacts: [],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    };

    activeJobs.set(jobId, jobState);

    // Launch separation in background / async
    separationEngine.separateTrack(jobId, safeFilePath, {
      modelName: modelName || 'htdemucs',
      stems: requestedStems,
      generateBackingTrack: generateBackingTrack === true
    }).then(result => {
      const current = activeJobs.get(jobId);
      if (!current) return;

      if (result.success) {
        current.state = 'completed';
        current.stage = 'done';
        current.progressPercentage = 100;
        current.createdArtifacts = result.stems;
        if (result.backingTrack) {
          current.createdArtifacts.push(result.backingTrack);
        }
        current.finishedAt = new Date().toISOString();
      } else {
        current.state = 'failed';
        current.stage = 'error';
        current.error = result.error;
        current.finishedAt = new Date().toISOString();
      }
    }).catch(err => {
      const current = activeJobs.get(jobId);
      if (current) {
        current.state = 'failed';
        current.stage = 'error';
        current.error = err.message;
        current.finishedAt = new Date().toISOString();
      }
    });

    res.json({
      jobId,
      state: jobState.state,
      progressPercentage: jobState.progressPercentage,
      message: 'Stem separation job started.'
    });
  }));

  // 4. Job Status & Cancellation
  router.get('/api/music-studio/jobs/:id', asyncHandler(async (req, res) => {
    const job = activeJobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Audio job not found.' });
    res.json(job);
  }));

  router.post('/api/music-studio/jobs/:id/cancel', asyncHandler(async (req, res) => {
    const jobId = req.params.id;
    const cancelled = separationEngine.cancelSeparation(jobId);
    const job = activeJobs.get(jobId);
    if (job) {
      job.state = 'cancelled';
      job.stage = 'cancelled_by_user';
    }
    res.json({ success: cancelled, jobId });
  }));

  // 5. Waveform Summary & Mixer State
  router.get('/api/music-studio/waveform', asyncHandler(async (req, res) => {
    const filePath = String(req.query.path || '');
    const stemType = (req.query.stemType || 'original') as StemType;
    const points = Number(req.query.points || 128);

    if (!filePath) return res.status(400).json({ error: 'path query parameter is required.' });

    const safeFilePath = resolveWorkspacePath(workspaceRoot, filePath, { label: 'path', mustExist: true, kind: 'file' });
    const summary = WaveformMixerEngine.generateWaveformSummary(safeFilePath, stemType, points);
    res.json(summary);
  }));

  router.post('/api/music-studio/mixer/init', asyncHandler(async (req, res) => {
    const { sessionId, stems } = req.body;
    const mixerState = WaveformMixerEngine.createDefaultMixerState(
      sessionId || `mixer-${Date.now()}`,
      stems || ['vocals', 'drums', 'bass', 'other']
    );
    res.json(mixerState);
  }));

  router.post('/api/music-studio/mixer/calculate-gains', asyncHandler(async (req, res) => {
    const { channels } = req.body;
    if (!channels || typeof channels !== 'object') {
      return res.status(400).json({ error: 'channels object is required.' });
    }
    const effective = WaveformMixerEngine.computeEffectiveChannelGains(channels);
    res.json({ effectiveGains: effective });
  }));

  // 6. Track Analysis (BPM, Key, LUFS)
  router.post('/api/music-studio/analyze', asyncHandler(async (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required.' });

    const safeFilePath = resolveWorkspacePath(workspaceRoot, filePath, { label: 'filePath', mustExist: true, kind: 'file' });
    const analysis = AudioTrackAnalyzer.analyzeTrack(safeFilePath);
    res.json(analysis);
  }));

  // 7. Export Package
  router.post('/api/music-studio/export', asyncHandler(async (req, res) => {
    const { outputDir, projectName, stems, mixerChannels, analysis } = req.body;
    if (!outputDir || !projectName || !Array.isArray(stems)) {
      return res.status(400).json({ error: 'outputDir, projectName, and stems array are required.' });
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(projectName)) {
      return res.status(400).json({ error: 'projectName contains unsafe filename characters.' });
    }

    const safeOutputDir = resolveWorkspacePath(workspaceRoot, outputDir, { label: 'outputDir' });
    const safeStems = stems.map(stem => ({
      ...stem,
      filePath: resolveWorkspacePath(workspaceRoot, stem.filePath, { label: 'stem.filePath', mustExist: true, kind: 'file' })
    }));
    const result = AudioExportMixdownService.exportStemPackage(
      safeOutputDir,
      projectName,
      safeStems,
      mixerChannels,
      analysis
    );
    res.json(result);
  }));

  // 8. DAW Handoff & FL Studio Script Generation
  router.post('/api/music-studio/daw-handoff', asyncHandler(async (req, res) => {
    const { stems, tempoBpm, dawName } = req.body;
    if (!Array.isArray(stems)) {
      return res.status(400).json({ error: 'stems array is required.' });
    }

    const safeStems = stems.map(stem => ({
      ...stem,
      filePath: resolveWorkspacePath(workspaceRoot, stem.filePath, { label: 'stem.filePath', mustExist: true, kind: 'file' })
    }));
    const layout = DAWIntegrationHandoff.generateDAWLayout(safeStems, tempoBpm || 120, dawName || 'FL Studio');
    const pythonScript = DAWIntegrationHandoff.generateFLStudioPythonScript(layout);

    res.json({
      layout,
      flStudioScript: pythonScript
    });
  }));

  return router;
}
