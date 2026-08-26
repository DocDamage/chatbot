import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FasterWhisperBackend, WindowsSapiTTSBackend, WindowsScreenCaptureBackend } from '../NativeVoiceBackends';
import { DemucsCliExecutor } from '../NativeAudioBackends';
import { FfmpegTesseractSubtitleOcrBackend, LocalDocumentNarrationBackend, LocalDubbingBackend } from '../NativeMediaBackends';
import { OllamaLocalAIBackend } from '../LocalAIBackends';
import { GodotCliBackend } from '../../gaming/godot/GodotCliBackend';

const mockNativeCommand = jest.fn();
const mockOllamaGenerate = jest.fn();
const mockOllamaHealth = jest.fn();
const mockTesseractRecognize = jest.fn();
const mockTesseractTerminate = jest.fn();

jest.mock('../NativeCommandRunner', () => ({
  runNativeCommand: (...args: unknown[]) => mockNativeCommand(...args)
}));
jest.mock('../../providers/OllamaAdapter', () => ({
  OllamaAdapter: jest.fn().mockImplementation(() => ({
    generate: (...args: unknown[]) => mockOllamaGenerate(...args),
    checkAvailability: (...args: unknown[]) => mockOllamaHealth(...args)
  }))
}));
jest.mock('tesseract.js', () => ({
  recognize: (...args: unknown[]) => mockTesseractRecognize(...args),
  createWorker: jest.fn(async () => ({
    recognize: (...args: unknown[]) => mockTesseractRecognize(...args),
    terminate: (...args: unknown[]) => mockTesseractTerminate(...args)
  }))
}));

function commandResult(overrides: Partial<{ exitCode: number; stdout: string; stderr: string; durationMs: number }> = {}) {
  return { exitCode: 0, stdout: '', stderr: '', durationMs: 12, ...overrides };
}

function pcmWav(sampleRate = 16_000, seconds = 1): Buffer {
  const dataBytes = sampleRate * 2 * seconds;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

describe('native capability backends', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-backends-'));
    mockNativeCommand.mockReset();
    mockOllamaGenerate.mockReset();
    mockOllamaHealth.mockReset();
    mockTesseractRecognize.mockReset();
    mockTesseractTerminate.mockReset();
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  describe('voice backends', () => {
    it.each([
      ['whisper-tiny.en', 'tiny.en'],
      ['whisper-small', 'small'],
      ['whisper-base.en', 'base.en']
    ])('maps %s and parses transcription payloads', async (modelId, expectedModel) => {
      mockNativeCommand.mockResolvedValue(commandResult({
        stdout: `diagnostic\n${JSON.stringify({ text: 'spoken text', confidence: 0.9, durationSec: 2, words: [{ word: 'spoken' }] })}`
      }));
      const backend = new FasterWhisperBackend('python', root);
      const result = await backend.transcribe(Buffer.from('audio'), {
        modelId, name: modelId, checksumSha256: '', sizeBytes: 0, license: '', isDownloaded: true
      }, { language: 'en' });
      expect(result).toMatchObject({ text: 'spoken text', confidence: 0.9, language: 'en', modelUsed: expectedModel });
      expect(mockNativeCommand).toHaveBeenCalledWith('python', expect.arrayContaining([expectedModel, 'en']), expect.any(Object));
    });

    it('reports native transcription failures and still cleans its temporary input', async () => {
      mockNativeCommand.mockResolvedValue(commandResult({ exitCode: 2, stderr: 'model failure' }));
      const backend = new FasterWhisperBackend('python', root);
      await expect(backend.transcribe(Buffer.from('audio'), {
        modelId: 'base', name: 'Base', checksumSha256: '', sizeBytes: 0, license: '', isDownloaded: true
      }, {}))
        .rejects.toThrow('model failure');

      mockNativeCommand.mockResolvedValueOnce(commandResult({ stdout: '{}' }));
      await expect(backend.transcribe(Buffer.from('audio'), {
        modelId: 'base', name: 'Base', checksumSha256: '', sizeBytes: 0, license: '', isDownloaded: true
      }, {})).resolves.toMatchObject({ text: '', confidence: 0, durationSec: 0, language: 'unknown', words: [] });
    });

    it('synthesizes WAV speech, clamps rate, and rejects missing artifacts', async () => {
      mockNativeCommand.mockImplementation(async (_executable: string, args: string[]) => {
        const output = args[args.indexOf('-OutputWavePath') + 1];
        fs.writeFileSync(output, pcmWav(22_050, 2));
        return commandResult();
      });
      const backend = new WindowsSapiTTSBackend('powershell', root);
      expect(backend.supportsVoice({ voiceId: 'native', displayName: 'Native', provider: 'os_native', language: 'en', gender: 'neutral', isLocalOnly: true, model: 'system' })).toBe(true);
      expect(backend.supportsVoice({ voiceId: 'cloud', displayName: 'Cloud', provider: 'cloud_elevenlabs', language: 'en', gender: 'neutral', isLocalOnly: false, model: 'cloud' })).toBe(false);
      const result = await backend.synthesize('hello', {} as never, { voiceId: 'native', speed: 9, format: 'wav' });
      expect(result).toMatchObject({ sampleRate: 22_050, durationSec: 2 });
      expect(mockNativeCommand.mock.calls[0][1]).toEqual(expect.arrayContaining(['-Rate', '10']));

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'sapi failed' }));
      await expect(backend.synthesize('hello', {} as never, { voiceId: 'native', format: 'wav' })).rejects.toThrow('sapi failed');

      mockNativeCommand.mockImplementationOnce(async (_executable: string, args: string[]) => {
        fs.writeFileSync(args[args.indexOf('-OutputWavePath') + 1], 'not a wave');
        return commandResult();
      });
      await expect(backend.synthesize('hello', {} as never, { voiceId: 'native', format: 'wav' })).rejects.toThrow('invalid WAV');
    });

    it('captures a bounded screen, OCRs text only when requested, and rejects command failure', async () => {
      mockTesseractRecognize.mockResolvedValue({ data: { text: ' first line \n\n second line ' } });
      mockNativeCommand.mockImplementation(async (_executable: string, args: string[]) => {
        const output = args[args.indexOf('-OutputPngPath') + 1];
        fs.writeFileSync(output, Buffer.from('png'));
        return commandResult({ stdout: '640,480\n' });
      });
      const backend = new WindowsScreenCaptureBackend('powershell', root);
      const capture = await backend.capture({ userTriggered: true, redactSensitiveText: true, bounds: { x: 1, y: 2, width: 640, height: 480 } });
      expect(capture).toMatchObject({ dimensions: { width: 640, height: 480 }, detectedTextSnippets: ['first line', 'second line'] });
      const noOcr = await backend.capture({ userTriggered: true, redactSensitiveText: false });
      expect(noOcr.detectedTextSnippets).toEqual([]);

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'capture failed' }));
      await expect(backend.capture({ userTriggered: true })).rejects.toThrow('capture failed');

      mockTesseractRecognize.mockResolvedValueOnce({ data: {} });
      mockNativeCommand.mockImplementationOnce(async (_executable: string, args: string[]) => {
        fs.writeFileSync(args[args.indexOf('-OutputPngPath') + 1], Buffer.from('png'));
        return commandResult({ stdout: '' });
      });
      await expect(backend.capture({ userTriggered: true, redactSensitiveText: true })).resolves.toMatchObject({
        dimensions: { width: 0, height: 0 }, detectedTextSnippets: []
      });
    });
  });

  describe('Ollama transformations', () => {
    it('health-checks and executes translation, clipboard, dictation, and writing transforms', async () => {
      mockOllamaHealth.mockResolvedValue({ available: true, models: ['qwen3:8b'] });
      mockOllamaGenerate.mockResolvedValue({ content: '<think>hidden</think>Result text' });
      const backend = new OllamaLocalAIBackend('http://127.0.0.1:11434', 'qwen3:8b');
      await expect(backend.health()).resolves.toMatchObject({ available: true });
      await expect(backend.translate('Hello', 'French')).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'summarize', rawClipboardText: 'Long text' })).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'translate', rawClipboardText: 'Hello' })).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'explain', rawClipboardText: 'Text' })).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'rewrite', rawClipboardText: 'Text' })).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'code_fix', rawClipboardText: 'code' })).resolves.toBe('Result text');
      await expect(backend.transform({ action: 'send_to_chat', rawClipboardText: 'Text' })).resolves.toBe('Result text');
      await expect(backend.transform({ mode: 'translate', text: 'Hello' })).resolves.toBe('Result text');
      await expect(backend.transform({ mode: 'code_draft', text: 'make code' })).resolves.toBe('Result text');
      await expect(backend.transform({ mode: 'instruction_draft', text: 'make prose', instructionPrompt: 'Formal' })).resolves.toBe('Result text');
      await expect(backend.transform({ mode: 'instruction_draft', text: 'make prose' })).resolves.toBe('Result text');
      await expect(backend.transform({
        text: 'Draft', action: 'tone', targetTone: 'warm', instruction: 'Keep names', providerModel: 'qwen3:8b', locality: 'local_only'
      })).resolves.toBe('Result text');
      await expect(backend.transform({
        text: 'Draft', action: 'summarize', providerModel: 'qwen3:8b', locality: 'local_only'
      })).resolves.toBe('Result text');
      expect(mockOllamaGenerate).toHaveBeenCalledTimes(13);
    });

    it('uses the documented endpoint and model defaults when no overrides are supplied', async () => {
      const previousBaseUrl = process.env.OLLAMA_BASE_URL;
      const previousModel = process.env.OLLAMA_MODEL;
      delete process.env.OLLAMA_BASE_URL;
      delete process.env.OLLAMA_MODEL;
      try {
        mockOllamaHealth.mockResolvedValue({ available: true });
        const backend = new OllamaLocalAIBackend();
        await expect(backend.health()).resolves.toEqual({ available: true });
      } finally {
        if (previousBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
        else process.env.OLLAMA_BASE_URL = previousBaseUrl;
        if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
        else process.env.OLLAMA_MODEL = previousModel;
      }
    });
  });

  describe('Demucs CLI', () => {
    function configureSuccessfulAudioCommands(): void {
      mockNativeCommand.mockImplementation(async (executable: string, args: string[]) => {
        if (executable === 'demucs') {
          const output = args[args.indexOf('-o') + 1];
          const stems = path.join(output, 'htdemucs', 'song');
          fs.mkdirSync(stems, { recursive: true });
          for (const stem of ['vocals', 'drums', 'bass', 'other']) fs.writeFileSync(path.join(stems, `${stem}.mp3`), stem);
        } else if (executable === 'ffmpeg') {
          fs.writeFileSync(args.at(-1) as string, pcmWav());
        } else if (executable === 'ffprobe') {
          return commandResult({ stdout: JSON.stringify({ format: { duration: '1' }, streams: [{ sample_rate: '16000', channels: 1 }] }) });
        }
        return commandResult();
      });
    }

    it('separates requested stems, converts artifacts, mixes a complement, and cancels tracked work', async () => {
      configureSuccessfulAudioCommands();
      const executor = new DemucsCliExecutor('demucs', 'ffmpeg', 'ffprobe');
      const progress = jest.fn();
      const artifacts = await executor.separate({
        jobId: 'job', inputAudioPath: path.join(root, 'song.wav'), outputDirectory: path.join(root, 'out'),
        config: { modelName: 'htdemucs', stems: ['vocals', 'drums', 'bass', 'other'], device: 'auto', shifts: 2, overlap: 0.25, twoStems: 'vocals' },
        onProgress: progress, isCancelled: () => false
      });
      expect(artifacts.map(item => item.stemType)).toEqual(expect.arrayContaining(['vocals', 'drums', 'bass', 'other', 'complement']));
      expect(artifacts.every(item => item.sha256.length === 64 && item.fileSizeBytes > 0)).toBe(true);
      expect(progress).toHaveBeenCalledTimes(2);

      const child = { kill: jest.fn() };
      mockNativeCommand.mockImplementationOnce(async (_executable: string, _args: string[], options: { onSpawn?: (value: unknown) => void }) => {
        options.onSpawn?.(child);
        return commandResult({ exitCode: 1, stderr: 'stopped' });
      });
      const pending = executor.separate({
        jobId: 'cancel-me', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'cancel'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => false
      });
      executor.cancel('cancel-me');
      await expect(pending).rejects.toThrow('Demucs separation failed');
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('fails for cancellation, missing outputs, and conversion errors', async () => {
      const executor = new DemucsCliExecutor('demucs', 'ffmpeg', 'ffprobe');
      mockNativeCommand.mockResolvedValue(commandResult());
      await expect(executor.separate({
        jobId: 'cancelled', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'cancelled'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => true
      })).rejects.toThrow('JOB_CANCELLED');
      await expect(executor.separate({
        jobId: 'empty', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'empty'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => false
      })).rejects.toThrow('without producing');

      configureSuccessfulAudioCommands();
      mockNativeCommand.mockImplementationOnce(async (_executable: string, args: string[]) => {
        const output = args[args.indexOf('-o') + 1];
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'vocals.mp3'), 'voice');
        return commandResult();
      }).mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'convert failed' }));
      await expect(executor.separate({
        jobId: 'convert', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'convert'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => false
      })).rejects.toThrow('convert failed');
    });

    it('uses configured devices, handles GPU auto-selection, and reports probe or complement failures', async () => {
      const previousGpu = process.env.GPU_AVAILABLE;
      process.env.GPU_AVAILABLE = 'true';
      try {
        configureSuccessfulAudioCommands();
        const executor = new DemucsCliExecutor('demucs', 'ffmpeg', 'ffprobe');
        await executor.separate({
          jobId: 'gpu', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'gpu'),
          config: { modelName: 'htdemucs', stems: ['vocals'], device: 'auto', twoStems: 'vocals' }, isCancelled: () => false
        });
        expect(mockNativeCommand.mock.calls[0][1]).toEqual(expect.arrayContaining(['-d', 'cuda']));
      } finally {
        if (previousGpu === undefined) delete process.env.GPU_AVAILABLE;
        else process.env.GPU_AVAILABLE = previousGpu;
      }

      configureSuccessfulAudioCommands();
      mockNativeCommand.mockImplementationOnce(async (_executable: string, args: string[]) => {
        const output = args[args.indexOf('-o') + 1];
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'vocals.mp3'), 'voice');
        return commandResult();
      }).mockImplementationOnce(async (_executable: string, args: string[]) => {
        fs.writeFileSync(args.at(-1) as string, pcmWav());
        return commandResult();
      }).mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'probe failed' }));
      const executor = new DemucsCliExecutor('demucs', 'ffmpeg', 'ffprobe');
      await expect(executor.separate({
        jobId: 'probe', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'probe'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => false
      })).rejects.toThrow('probe failed');

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stdout: 'demucs stdout failure' }));
      await expect(executor.separate({
        jobId: 'stdout-error', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'stdout-error'),
        config: { modelName: 'htdemucs', stems: ['vocals'], device: 'cpu' }, isCancelled: () => false
      })).rejects.toThrow('demucs stdout failure');

      mockNativeCommand.mockImplementation(async (executable: string, args: string[]) => {
        if (executable === 'demucs') {
          const stems = path.join(args[args.indexOf('-o') + 1], 'htdemucs', 'song');
          fs.mkdirSync(stems, { recursive: true });
          for (const stem of ['vocals', 'drums']) fs.writeFileSync(path.join(stems, `${stem}.mp3`), stem);
        } else if (executable === 'ffmpeg' && args.includes('-filter_complex')) {
          return commandResult({ exitCode: 1, stderr: 'mix reconstruction failed' });
        } else if (executable === 'ffmpeg') {
          fs.writeFileSync(args.at(-1) as string, pcmWav());
        } else if (executable === 'ffprobe') {
          return commandResult({ stdout: '{}' });
        }
        return commandResult();
      });
      await expect(executor.separate({
        jobId: 'mix', inputAudioPath: 'song.wav', outputDirectory: path.join(root, 'mix'),
        config: { modelName: 'htdemucs', stems: ['vocals', 'drums'], device: 'cpu', twoStems: 'vocals' }, isCancelled: () => false
      })).rejects.toThrow('mix reconstruction failed');
    });
  });

  describe('media backends', () => {
    it('extracts OCR candidates with bounded frame settings and terminates the worker', async () => {
      mockNativeCommand.mockImplementation(async (_executable: string, args: string[]) => {
        const pattern = args.find(value => typeof value === 'string' && value.includes('frame-%06d.png')) as string;
        fs.writeFileSync(pattern.replace('%06d', '000001'), 'frame');
        fs.writeFileSync(pattern.replace('%06d', '000002'), 'frame');
        return commandResult();
      });
      mockTesseractRecognize
        .mockResolvedValueOnce({ data: { text: ' ACCESSIBILITY   WORKS ', confidence: 96 } })
        .mockResolvedValueOnce({ data: { text: '', confidence: 0 } });
      const backend = new FfmpegTesseractSubtitleOcrBackend('ffmpeg');
      const result = await backend.extractCandidates({
        videoPath: 'video.mp4', cropRegion: { x: 1.2, y: 2.2, width: 100.6, height: 40.4 },
        frameSampleRateFps: 20, maxFramesToProcess: 5000, language: 'es'
      });
      expect(result).toEqual({ candidates: [{ timeSec: 0, text: 'ACCESSIBILITY WORKS', confidence: 0.96 }], totalFramesProcessed: 2 });
      expect(mockTesseractTerminate).toHaveBeenCalled();

      mockTesseractRecognize.mockResolvedValue({ data: { text: 'Low', confidence: -20 } });
      const defaults = await backend.extractCandidates({
        videoPath: 'video.mp4', cropRegion: { x: 0, y: 0, width: 1, height: 1 },
        frameSampleRateFps: 0.01, maxFramesToProcess: 0, language: 'custom'
      });
      expect(defaults.candidates[0].confidence).toBe(0);

      mockTesseractRecognize.mockResolvedValue({ data: { text: 'No confidence' } });
      const languageDefaults = await backend.extractCandidates({
        videoPath: 'video.mp4', cropRegion: { x: 0, y: 0, width: 1, height: 1 }
      });
      expect(languageDefaults.candidates[0]).toMatchObject({ text: 'No confidence', confidence: 0 });
    });

    it('renders timing-fitted dubbing and chaptered narration artifacts', async () => {
      const tts = { synthesize: jest.fn(async () => ({ audioBuffer: pcmWav(), durationSec: 2, sampleRate: 16_000 })) };
      mockNativeCommand.mockImplementation(async (executable: string, args: string[]) => {
        if (executable === 'ffmpeg') fs.writeFileSync(args.at(-1) as string, pcmWav());
        if (executable === 'ffprobe') return commandResult({ stdout: JSON.stringify({ format: { duration: '2' }, streams: [{ sample_rate: '16000', channels: 1 }] }) });
        return commandResult();
      });
      const dubbing = new LocalDubbingBackend(tts as never, 'ffmpeg', 'ffprobe', root);
      const dubbed = await dubbing.render([
        { id: '1', index: 1, startSec: 0, endSec: 1, text: 'First' },
        { id: '2', index: 2, startSec: 2, endSec: 5, text: 'Second' }
      ], {
        projectId: 'unsafe project/name', targetLanguage: 'es', voiceId: 'native', duckOriginalAudio: true,
        allowSpeedAdjustment: true, maxSpeedFactor: 1.5
      }, 'Synthetic speech');
      expect(dubbed).toMatchObject({ cueCount: 2, speedAdjustedCuesCount: 1, durationSec: 2 });
      expect(fs.existsSync(dubbed.outputAudioPath)).toBe(true);

      const narration = new LocalDocumentNarrationBackend(tts as never, 'ffprobe', root);
      const narrated = await narration.synthesize({
        documentTitle: 'Guide', voiceId: 'native', sampleRate: 16_000,
        chapters: [{ chapterIndex: 1, title: 'A/B: Intro', rawText: 'Intro', cleanedText: 'Intro', estimatedReadingTimeMin: 1 }]
      });
      expect(narrated).toMatchObject({ documentTitle: 'Guide', chaptersSynthesized: 1, totalAudioDurationSec: 2 });
      expect(fs.existsSync(narrated.manifestPackagePath)).toBe(true);

      const emptyNarration = await narration.synthesize({ documentTitle: 'Empty', voiceId: 'native', chapters: [] });
      expect(emptyNarration).toMatchObject({ chaptersSynthesized: 0, totalAudioDurationSec: 0 });
    });

    it('reports OCR, timing-fit, mix, and probe command failures', async () => {
      const ocr = new FfmpegTesseractSubtitleOcrBackend('ffmpeg');
      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'extract failed' }));
      await expect(ocr.extractCandidates({ videoPath: 'bad.mp4', cropRegion: { x: 0, y: 0, width: 1, height: 1 } }))
        .rejects.toThrow('extract failed');

      const tts = { synthesize: jest.fn(async () => ({ audioBuffer: pcmWav(), durationSec: 2, sampleRate: 16_000 })) };
      const dubbing = new LocalDubbingBackend(tts as never, 'ffmpeg', 'ffprobe', root);
      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'fit failed' }));
      await expect(dubbing.render([{ id: '1', index: 1, startSec: 0, endSec: 1, text: 'Cue' }], {
        projectId: 'p', targetLanguage: 'es', voiceId: 'native', duckOriginalAudio: false, allowSpeedAdjustment: true
      }, 'notice')).rejects.toThrow('fit failed');

      const noFitTts = { synthesize: jest.fn(async () => ({ audioBuffer: pcmWav(), durationSec: 0.5, sampleRate: 16_000 })) };
      const noFit = new LocalDubbingBackend(noFitTts as never, 'ffmpeg', 'ffprobe', root);
      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'mix failed' }));
      await expect(noFit.render([{ id: '1', index: 1, startSec: 0, endSec: 1, text: 'Cue' }], {
        projectId: 'p', targetLanguage: 'es', voiceId: 'native', duckOriginalAudio: false, allowSpeedAdjustment: false
      }, 'notice')).rejects.toThrow('mix failed');

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 0 }));
      await expect(noFit.render([{ id: '1', index: 1, startSec: 0, endSec: 2, text: 'Cue' }], {
        projectId: '***', targetLanguage: 'es', voiceId: 'native', duckOriginalAudio: false, allowSpeedAdjustment: false
      }, 'notice')).rejects.toThrow('Dubbing mix failed');

      const narration = new LocalDocumentNarrationBackend(tts as never, 'ffprobe', root);
      mockNativeCommand.mockResolvedValueOnce(commandResult({ stdout: '{}' }));
      await expect(narration.synthesize({
        documentTitle: 'Defaults', voiceId: 'native', chapters: [{ chapterIndex: 1, title: 'One', rawText: 'One', cleanedText: 'One', estimatedReadingTimeMin: 1 }]
      })).resolves.toMatchObject({ totalAudioDurationSec: 0 });

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 1, stderr: 'narration probe failed' }));
      await expect(narration.synthesize({
        documentTitle: 'Probe failure', voiceId: 'native', chapters: [{ chapterIndex: 1, title: 'One', rawText: 'One', cleanedText: 'One', estimatedReadingTimeMin: 1 }]
      })).rejects.toThrow('narration probe failed');
    });
  });

  describe('Godot CLI', () => {
    it('parses runtime assertions and real profiler payloads and exports an existing artifact', async () => {
      const output = path.join(root, 'game.exe');
      mockNativeCommand
        .mockResolvedValueOnce(commandResult({ stdout: `CHATBOT_RUNTIME_JSON:${JSON.stringify({ scene: 'Main.tscn', assertions: [{ type: 'node_exists', target: 'Hero', expected: true, actual: true, passed: true }] })}` }))
        .mockResolvedValueOnce(commandResult({ stdout: `CHATBOT_PROFILE_JSON:${JSON.stringify({ fps: 60, frameTimeMs: 16.67, nodeCount: 4, memoryMb: 32 })}` }))
        .mockImplementationOnce(async () => { fs.writeFileSync(output, 'game'); return commandResult(); });
      const backend = new GodotCliBackend('godot', root);
      const runtime = await backend.runScenario(root, { scenePath: 'Main.tscn' }, [{ type: 'node_exists', target: 'Hero', expected: true }]);
      expect(runtime.passed).toBe(true);
      await expect(backend.profileProject(root)).resolves.toMatchObject({ fps: 60, nodeCount: 4 });
      await expect(backend.exportProject(root, {
        name: 'Windows Desktop', platform: 'windows', exportPath: 'game.exe', templateVersion: 'installed'
      }, root)).resolves.toMatchObject({ success: true, byteSize: 4 });

      mockNativeCommand.mockImplementationOnce(async (_executable: string, args: string[]) => {
        fs.writeFileSync(args.at(-1) as string, 'web');
        return commandResult();
      });
      await expect(backend.exportProject(root, {
        name: 'Web', platform: 'web', exportPath: 'web-build', templateVersion: 'installed'
      }, root)).resolves.toMatchObject({ success: true });
    });

    it('returns failed assertions and rejects invalid profiler execution', async () => {
      mockNativeCommand
        .mockResolvedValueOnce(commandResult({ exitCode: 2, stderr: 'runtime failed' }))
        .mockResolvedValueOnce(commandResult({ stdout: 'no profile payload' }));
      const backend = new GodotCliBackend('godot', root);
      const runtime = await backend.runScenario(root, {}, [{ type: 'screen_text', target: 'Label', expected: 'Hello' }]);
      expect(runtime).toMatchObject({ passed: false, error: 'Godot exited with code 2.' });
      await expect(backend.profileProject(root)).rejects.toThrow('Godot profiler probe failed');

      mockNativeCommand.mockResolvedValueOnce(commandResult({ exitCode: 5, stderr: 'export failed' }));
      await expect(backend.exportProject(root, {
        name: 'macOS', platform: 'macos', exportPath: 'mac-build', templateVersion: 'installed'
      }, root)).resolves.toMatchObject({ success: false, error: 'Godot export exited with code 5.' });
    });
  });
});
