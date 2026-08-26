/**
 * Phase PX-11 Evaluation & Audio Quality Test Suite
 *
 * Tests Audio Rights Preflight, Demucs Worker Isolation, Hardware Probing,
 * Ingest Normalization & DRM Rejection, Stem Separation & Backing Tracks,
 * Waveform Summaries & Mixer Math, Audio Track Analysis (BPM, Key, LUFS),
 * Mixdown Exports, and FL Studio / DAW Routing Handoffs.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { AudioJobRightsModel } from '../AudioJobRightsModel';
import { DemucsWorkerAdapter } from '../DemucsWorkerAdapter';
import { AudioIngestNormalizer } from '../AudioIngestNormalizer';
import { StemSeparationEngine } from '../StemSeparationEngine';
import { WaveformMixerEngine } from '../WaveformMixerEngine';
import { AudioTrackAnalyzer } from '../AudioTrackAnalyzer';
import { AudioExportMixdownService } from '../AudioExportMixdownService';
import { DAWIntegrationHandoff } from '../DAWIntegrationHandoff';
import { AudioRightsDeclaration, MixerChannel, StemArtifact } from '../StemdeckTypes';

describe('Phase PX-11: Local Stem Separation, Mixer, and Audio Analysis Lab', () => {
  let tempDir: string;
  let sampleWavPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-studio-test-'));

    // Create a 2-second synthetic 16-bit 44.1kHz stereo WAV test file
    sampleWavPath = path.join(tempDir, 'test_song.wav');
    const sampleRate = 44100;
    const durationSec = 2;
    const numSamples = sampleRate * durationSec;
    const blockAlign = 4; // 2 channels * 2 bytes
    const dataSize = numSamples * blockAlign;

    const wavBuf = Buffer.alloc(44 + dataSize);
    wavBuf.write('RIFF', 0);
    wavBuf.writeUInt32LE(36 + dataSize, 4);
    wavBuf.write('WAVE', 8);
    wavBuf.write('fmt ', 12);
    wavBuf.writeUInt32LE(16, 16);
    wavBuf.writeUInt16LE(1, 20); // PCM
    wavBuf.writeUInt16LE(2, 22); // Stereo
    wavBuf.writeUInt32LE(sampleRate, 24);
    wavBuf.writeUInt32LE(sampleRate * blockAlign, 28);
    wavBuf.writeUInt16LE(blockAlign, 32);
    wavBuf.writeUInt16LE(16, 34); // 16-bit
    wavBuf.write('data', 36);
    wavBuf.writeUInt32LE(dataSize, 40);

    for (let i = 0; i < numSamples; i++) {
      const val = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000);
      const offset = 44 + i * blockAlign;
      wavBuf.writeInt16LE(val, offset);
      wavBuf.writeInt16LE(val, offset + 2);
    }

    fs.writeFileSync(sampleWavPath, wavBuf);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createWorkerAdapter(): DemucsWorkerAdapter {
    return new DemucsWorkerAdapter({
      async separate({ inputAudioPath, outputDirectory, config, isCancelled }) {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (isCancelled()) throw new Error('JOB_CANCELLED: fixture worker cancelled.');
        const source = fs.readFileSync(inputAudioPath);
        const requested = [...config.stems, ...(config.twoStems ? ['complement' as const] : [])];
        return requested.map(stemType => {
          const filePath = path.join(outputDirectory, `${stemType}.wav`);
          fs.writeFileSync(filePath, source);
          return {
            stemType,
            filePath,
            durationSeconds: 2,
            sampleRate: 44100,
            channels: 2,
            sha256: crypto.createHash('sha256').update(source).digest('hex'),
            fileSizeBytes: source.length
          };
        });
      }
    });
  }

  describe('PX11-T01: Audio Job & Rights Model', () => {
    it('rejects processing without explicit user rights declaration', () => {
      const invalidRights: AudioRightsDeclaration = {
        hasExplicitUserConsent: false,
        declarationText: '',
        processingLocation: 'local_only',
        declaredAt: new Date().toISOString()
      };

      const result = AudioJobRightsModel.preflightAudio(sampleWavPath, invalidRights);
      expect(result.valid).toBe(false);
      expect(result.rightsVerified).toBe(false);
      expect(result.error).toContain('RIGHTS_DECLARATION_REQUIRED');
    });

    it('rejects unauthorized remote processing and enforces local-only boundary', () => {
      const remoteRights: AudioRightsDeclaration = {
        hasExplicitUserConsent: true,
        declarationText: 'I own this audio',
        processingLocation: 'approved_remote',
        declaredAt: new Date().toISOString()
      };

      const result = AudioJobRightsModel.preflightAudio(sampleWavPath, remoteRights);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('DATA_EGRESS_POLICY');
    });

    it('verifies valid audio rights, calculates resource estimates, and generates digest', () => {
      const validRights: AudioRightsDeclaration = {
        hasExplicitUserConsent: true,
        declarationText: 'I am the creator of this track and authorize local stem separation.',
        processingLocation: 'local_only',
        declaredAt: new Date().toISOString()
      };

      const result = AudioJobRightsModel.preflightAudio(sampleWavPath, validRights, ['vocals', 'drums', 'bass', 'other']);
      expect(result.valid).toBe(true);
      expect(result.rightsVerified).toBe(true);
      expect(result.audioInfo.codec).toBe('wav');
      expect(result.resourceEstimate.estimatedVramBytes).toBeGreaterThan(0);

      const digest = AudioJobRightsModel.computeRightsDigest(sampleWavPath, 'user-1', validRights.declarationText);
      expect(digest.length).toBe(64); // SHA-256 hex string
    });
  });

  describe('PX11-T02 & PX11-T09: Worker Isolation, Hardware Probing & Cancellation', () => {
    it('probes available hardware acceleration and returns device info', async () => {
      const adapter = new DemucsWorkerAdapter();
      const hw = await adapter.probeHardwareAcceleration();
      expect(['cuda', 'mps', 'cpu']).toContain(hw.device);
      expect(hw.recommendedModel).toBeDefined();
      expect(hw.workerAvailable).toBe(false);
    });

    it('handles worker job cancellation and cleans up temp directories', async () => {
      const adapter = createWorkerAdapter();
      const jobId = 'test-job-cancel-1';

      // Start separation and immediately cancel
      const promise = adapter.separateStems(jobId, sampleWavPath, {
        modelName: 'htdemucs',
        stems: ['vocals', 'drums', 'bass', 'other'],
        device: 'cpu'
      });

      adapter.cancelJob(jobId);

      await expect(promise).rejects.toThrow(/JOB_CANCELLED/);
    });
  });

  describe('PX11-T03: Audio Ingest & Normalization Inspector', () => {
    it('inspects valid WAV headers and verifies sample rate/channels', () => {
      const result = AudioIngestNormalizer.inspectAndValidate(sampleWavPath);
      expect(result.valid).toBe(true);
      expect(result.format).toBe('wav');
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.isDrmProtected).toBe(false);
    });

    it('rejects corrupt audio and detects DRM encrypted signatures', () => {
      const drmPath = path.join(tempDir, 'drm_track.m4a');
      const drmBuf = Buffer.alloc(128);
      drmBuf.write('sinf drms protected content', 0);
      fs.writeFileSync(drmPath, drmBuf);

      const drmRes = AudioIngestNormalizer.inspectAndValidate(drmPath);
      expect(drmRes.valid).toBe(false);
      expect(drmRes.isDrmProtected).toBe(true);
      expect(drmRes.error).toContain('DRM_ENCRYPTED_AUDIO');
    });
  });

  describe('PX11-T04: Stem Separation & Complement Backing Tracks', () => {
    it('extracts stems and produces a backing track complement with machine disclaimer', async () => {
      const engine = new StemSeparationEngine(createWorkerAdapter());
      const result = await engine.separateTrack('job-sep-1', sampleWavPath, {
        modelName: 'htdemucs',
        stems: ['vocals', 'drums', 'bass', 'other'],
        generateBackingTrack: true
      });

      expect(result.success).toBe(true);
      expect(result.stems.length).toBe(4);
      expect(result.backingTrack).toBeDefined();
      expect(result.backingTrack?.stemType).toBe('complement');
      expect(result.confidenceDisclaimer).toContain('Machine-separated stems are AI estimates');
    });

    it('fails closed when no real stem-separation worker is configured', async () => {
      const engine = new StemSeparationEngine();
      const result = await engine.separateTrack('job-no-worker', sampleWavPath);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/DEMUCS_BACKEND_UNAVAILABLE/);
    });
  });

  describe('PX11-T05: Waveform Summaries & Multitrack Mixer Math', () => {
    it('generates bounded min/max waveform envelope and computes channel panning/gains', () => {
      const summary = WaveformMixerEngine.generateWaveformSummary(sampleWavPath, 'original', 64);
      expect(summary.pointCount).toBe(64);
      expect(summary.peaksMin.length).toBe(64);
      expect(summary.peaksMax.length).toBe(64);
      expect(summary.rms.length).toBe(64);
      expect(summary.durationSeconds).toBeGreaterThan(0);

      const channels: Record<string, MixerChannel> = {
        vocals: { stemType: 'vocals', gainDb: -6.0, pan: -0.5, mute: false, solo: false, monitor: true },
        drums: { stemType: 'drums', gainDb: 0.0, pan: 0.0, mute: false, solo: false, monitor: true },
        bass: { stemType: 'bass', gainDb: 0.0, pan: 0.0, mute: true, solo: false, monitor: true }
      };

      const effectiveGains = WaveformMixerEngine.computeEffectiveChannelGains(channels);
      // Muted channel should have 0 gain
      expect(effectiveGains.bass.leftGain).toBe(0);
      expect(effectiveGains.bass.rightGain).toBe(0);

      // Panned left should have higher leftGain than rightGain
      expect(effectiveGains.vocals.leftGain).toBeGreaterThan(effectiveGains.vocals.rightGain);
    });
  });

  describe('PX11-T06: Audio Track Analysis (BPM, Key, LUFS)', () => {
    it('analyzes audio dynamics, integrated LUFS loudness, and estimates BPM and key', () => {
      const analysis = AudioTrackAnalyzer.analyzeTrack(sampleWavPath);

      expect(analysis.bpm).toBeGreaterThan(0);
      expect(analysis.bpmConfidence).toBeGreaterThan(0);
      expect(analysis.key).toBeDefined();
      expect(analysis.integratedLufs).toBeLessThanOrEqual(0);
      expect(analysis.truePeakDbfs).toBeLessThanOrEqual(0);
      expect(analysis.sections?.length).toBeGreaterThan(0);
    });
  });

  describe('PX11-T07: Audio Export & Multitrack Mixdown Package', () => {
    it('packages stem artifacts, renders mixdown, and writes cryptographic manifest', () => {
      const exportDir = path.join(tempDir, 'export_stems');
      const stems: StemArtifact[] = [
        { stemType: 'vocals', filePath: sampleWavPath, durationSeconds: 2, sampleRate: 44100, channels: 2, sha256: 'abc1', fileSizeBytes: 1000 },
        { stemType: 'drums', filePath: sampleWavPath, durationSeconds: 2, sampleRate: 44100, channels: 2, sha256: 'abc2', fileSizeBytes: 1000 }
      ];

      const channels: Record<string, MixerChannel> = {
        vocals: { stemType: 'vocals', gainDb: 0, pan: 0, mute: false, solo: false, monitor: true },
        drums: { stemType: 'drums', gainDb: 0, pan: 0, mute: false, solo: false, monitor: true }
      };

      const analysis = AudioTrackAnalyzer.analyzeTrack(sampleWavPath);

      const pkg = AudioExportMixdownService.exportStemPackage(
        exportDir,
        'MySong',
        stems,
        channels,
        analysis
      );

      expect(pkg.success).toBe(true);
      expect(fs.existsSync(pkg.manifestPath)).toBe(true);
      expect(pkg.exportedFiles.length).toBeGreaterThanOrEqual(4); // stems + mixdown + json + csv

      const manifestData = JSON.parse(fs.readFileSync(pkg.manifestPath, 'utf-8'));
      expect(manifestData.projectName).toBe('MySong');
      expect(manifestData.files.some((f: any) => f.path.endsWith('.csv'))).toBe(true);
    });
  });

  describe('PX11-T08: FL Studio & DAW Routing Handoff', () => {
    it('generates dry-run DAW layout proposal and FL Studio Python script with exact approval digest', () => {
      const stems: StemArtifact[] = [
        { stemType: 'drums', filePath: '/stems/drums.wav', durationSeconds: 2, sampleRate: 44100, channels: 2, sha256: '1', fileSizeBytes: 100 },
        { stemType: 'bass', filePath: '/stems/bass.wav', durationSeconds: 2, sampleRate: 44100, channels: 2, sha256: '2', fileSizeBytes: 100 },
        { stemType: 'vocals', filePath: '/stems/vocals.wav', durationSeconds: 2, sampleRate: 44100, channels: 2, sha256: '3', fileSizeBytes: 100 }
      ];

      const layout = DAWIntegrationHandoff.generateDAWLayout(stems, 130, 'FL Studio');
      expect(layout.dawName).toBe('FL Studio');
      expect(layout.tempoBpm).toBe(130);
      expect(layout.tracks.length).toBe(3);
      expect(layout.isDryRun).toBe(true);
      expect(layout.approvalRequired).toBe(true);
      expect(layout.approvalScopeDigest).toBeDefined();

      const script = DAWIntegrationHandoff.generateFLStudioPythonScript(layout);
      expect(script).toContain('mixer.setTrackName(1, "DRUMS Stem")');
      expect(script).toContain('mixer.setTrackName(2, "BASS Stem")');
    });
  });
});
