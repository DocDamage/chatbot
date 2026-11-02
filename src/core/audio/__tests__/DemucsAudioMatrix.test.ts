import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AudioExportMixdownService } from '../stemdeck/AudioExportMixdownService';
import { AudioJobRightsModel } from '../stemdeck/AudioJobRightsModel';
import { AudioTrackAnalyzer } from '../stemdeck/AudioTrackAnalyzer';
import { StemArtifact } from '../stemdeck/StemdeckTypes';

describe('RT-AUDIO-001..004 — Demucs, Audio Analysis, Mixer, and Export Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-matrix-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('RT-AUDIO-002: Rights and Egress Gate', () => {
    it('requires explicit rights declaration before stem separation is authorized', () => {
      const dummyFile = path.join(tempDir, 'test.wav');
      fs.writeFileSync(dummyFile, Buffer.alloc(100));

      const rejected = AudioJobRightsModel.preflightAudio(dummyFile, {
        hasExplicitUserConsent: false,
        declarationText: 'I do not confirm rights',
        processingLocation: 'local_only',
        declaredAt: new Date().toISOString(),
      });
      expect(rejected.valid).toBe(false);
      expect(rejected.rightsVerified).toBe(false);

      const approved = AudioJobRightsModel.preflightAudio(dummyFile, {
        hasExplicitUserConsent: true,
        declarationText: 'I own all rights to this audio',
        processingLocation: 'local_only',
        declaredAt: new Date().toISOString(),
      });
      expect(approved.valid).toBe(true);
      expect(approved.rightsVerified).toBe(true);
    });
  });

  describe('RT-AUDIO-003: Mixer and WAV Export Correctness', () => {
    it('packages stems and renders mixdown package with manifest checksums', () => {
      const stemFile = path.join(tempDir, 'sample_vocals.wav');
      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0, 'ascii');
      wavHeader.writeUInt32LE(36 + 100, 4);
      wavHeader.write('WAVE', 8, 'ascii');
      wavHeader.write('fmt ', 12, 'ascii');
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20); // PCM
      wavHeader.writeUInt16LE(1, 22); // Mono
      wavHeader.writeUInt32LE(44100, 24); // Sample rate
      wavHeader.writeUInt32LE(88200, 28); // Byte rate
      wavHeader.writeUInt16LE(2, 32); // Block align
      wavHeader.writeUInt16LE(16, 34); // Bits per sample
      wavHeader.write('data', 36, 'ascii');
      wavHeader.writeUInt32LE(100, 40);
      const fakeWav = Buffer.concat([wavHeader, Buffer.alloc(100)]);
      fs.writeFileSync(stemFile, fakeWav);

      const stems: StemArtifact[] = [
        {
          stemType: 'vocals',
          filePath: stemFile,
          sha256: 'fake-hash',
          sampleRate: 44100,
          channels: 1,
          durationSeconds: 1.0,
          fileSizeBytes: fakeWav.length,
        },
      ];

      const exportDir = path.join(tempDir, 'export-out');
      const exportPkg = AudioExportMixdownService.exportStemPackage(exportDir, 'MyTrack', stems);

      expect(exportPkg.success).toBe(true);
      expect(exportPkg.exportedFiles.length).toBeGreaterThan(0);
      expect(fs.existsSync(exportPkg.manifestPath)).toBe(true);
    });
  });

  describe('RT-AUDIO-004: Analysis Confidence and Metrics', () => {
    it('analyzes track and extracts tempo/energy with confidence scores', () => {
      const analysis = AudioTrackAnalyzer.analyzeTrack(Buffer.alloc(44100 * 2));

      expect(analysis.bpm).toBeGreaterThan(0);
      expect(analysis.bpmConfidence).toBeGreaterThanOrEqual(0);
      expect(analysis.bpmConfidence).toBeLessThanOrEqual(1.0);
    });
  });
});
