import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalSTTBackend } from '../voice-companion/LocalSTTProvider';
import { LocalTTSBackend, VoiceDescriptor } from '../voice-companion/LocalTTSProvider';
import { ScreenCaptureBackend } from '../voice-companion/ScreenContextCaptureService';
import { ModelChecksumNotice, ScreenCaptureRequest, STTTranscriptionOptions, TTSSynthesisOptions } from '../voice-companion/VoiceCompanionTypes';
import { runNativeCommand } from './NativeCommandRunner';

function removeDirectory(directory: string): void {
  try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* best effort */ }
}

function wavMetadata(buffer: Buffer): { sampleRate: number; durationSec: number } {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Native TTS returned an invalid WAV artifact.');
  }
  const sampleRate = buffer.readUInt32LE(24);
  const channels = buffer.readUInt16LE(22);
  const bits = buffer.readUInt16LE(34);
  let offset = 12;
  let dataBytes = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'data') { dataBytes = Math.min(size, buffer.length - offset - 8); break; }
    offset += 8 + size + (size % 2);
  }
  return { sampleRate, durationSec: dataBytes / Math.max(1, sampleRate * channels * (bits / 8)) };
}

export class FasterWhisperBackend implements LocalSTTBackend {
  constructor(
    private readonly pythonPath: string,
    private readonly workspaceRoot: string,
    private readonly modelCache = path.join(workspaceRoot, 'data', 'native-runtime', 'models', 'whisper')
  ) {}

  public async transcribe(audioBuffer: Buffer, model: ModelChecksumNotice, options: STTTranscriptionOptions) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-stt-'));
    const audioPath = path.join(tempDir, 'input.audio');
    fs.writeFileSync(audioPath, audioBuffer);
    const modelName = model.modelId.includes('tiny') ? 'tiny.en' : model.modelId.includes('small') ? 'small' : 'base.en';
    try {
      const result = await runNativeCommand(this.pythonPath, [
        path.join(this.workspaceRoot, 'scripts', 'native', 'faster_whisper_transcribe.py'),
        audioPath,
        modelName,
        this.modelCache,
        options.language || ''
      ], { timeoutMs: 15 * 60_000 });
      if (result.exitCode !== 0) throw new Error(`Faster Whisper failed: ${result.stderr.trim()}`);
      const payload = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1) || '{}');
      return {
        text: String(payload.text || ''),
        confidence: Number(payload.confidence || 0),
        durationSec: Number(payload.durationSec || 0),
        language: String(payload.language || options.language || 'unknown'),
        words: Array.isArray(payload.words) ? payload.words : [],
        processingTimeMs: result.durationMs,
        provider: 'whisper_local' as const,
        modelUsed: modelName,
        isLocalOnly: true
      };
    } finally {
      removeDirectory(tempDir);
    }
  }
}

export class WindowsSapiTTSBackend implements LocalTTSBackend {
  constructor(private readonly powershellPath: string, private readonly workspaceRoot: string) {}

  public supportsVoice(voice: VoiceDescriptor): boolean {
    return voice.provider === 'os_native';
  }

  public async synthesize(text: string, _voice: VoiceDescriptor, options: TTSSynthesisOptions) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-tts-'));
    const inputPath = path.join(tempDir, 'input.txt');
    const outputPath = path.join(tempDir, 'speech.wav');
    fs.writeFileSync(inputPath, text, 'utf8');
    const rate = Math.round(Math.max(-10, Math.min(10, ((options.speed || 1) - 1) * 10)));
    try {
      const result = await runNativeCommand(this.powershellPath, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(this.workspaceRoot, 'scripts', 'native', 'windows-sapi-tts.ps1'),
        '-InputTextPath', inputPath, '-OutputWavePath', outputPath, '-Rate', String(rate)
      ], { timeoutMs: 120_000 });
      if (result.exitCode !== 0 || !fs.existsSync(outputPath)) {
        throw new Error(`Windows SAPI synthesis failed: ${result.stderr.trim()}`);
      }
      const audioBuffer = fs.readFileSync(outputPath);
      const metadata = wavMetadata(audioBuffer);
      return { audioBuffer, durationSec: metadata.durationSec, sampleRate: metadata.sampleRate };
    } finally {
      removeDirectory(tempDir);
    }
  }
}

export class WindowsScreenCaptureBackend implements ScreenCaptureBackend {
  constructor(private readonly powershellPath: string, private readonly workspaceRoot: string) {}

  public async capture(request: ScreenCaptureRequest) {
    if (process.platform !== 'win32' && process.env.NODE_ENV !== 'test') {
      throw new Error('Windows screen capture backend is only available on Windows.');
    }
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-screen-'));
    const outputPath = path.join(tempDir, 'capture.png');
    const bounds = request.bounds;
    try {
      const result = await runNativeCommand(this.powershellPath, [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(this.workspaceRoot, 'scripts', 'native', 'windows-screen-capture.ps1'),
        '-OutputPngPath', outputPath,
        '-X', String(bounds?.x || 0), '-Y', String(bounds?.y || 0),
        '-Width', String(bounds?.width || 0), '-Height', String(bounds?.height || 0)
      ], { timeoutMs: 30_000 });
      if (result.exitCode !== 0 || !fs.existsSync(outputPath)) {
        throw new Error(`Windows screen capture failed: ${result.stderr.trim()}`);
      }
      const dimensionsText = result.stdout.trim().split(/\r?\n/).at(-1) || '0,0';
      const [width, height] = dimensionsText.split(',').map(Number);
      const imageBuffer = fs.readFileSync(outputPath);
      const detectedTextSnippets = request.redactSensitiveText ? await this.extractText(imageBuffer) : [];
      return { imageBuffer, dimensions: { width, height }, detectedTextSnippets };
    } finally {
      removeDirectory(tempDir);
    }
  }

  private async extractText(imageBuffer: Buffer): Promise<string[]> {
    const tesseract = require('tesseract.js') as { recognize(input: Buffer, language: string): Promise<{ data: { text?: string } }> };
    const result = await tesseract.recognize(imageBuffer, 'eng');
    return String(result.data.text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 100);
  }
}
