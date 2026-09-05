import { VoiceAgent } from '../VoiceAgent';
import axios from 'axios';
import * as fs from 'fs';
import { Readable } from 'stream';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('fs', () => {
  const original = jest.requireActual('fs');
  return {
    ...original,
    createReadStream: jest.fn().mockImplementation(() => {
      const s = new Readable();
      s.push(null);
      return s;
    }),
    writeFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true)
  };
});

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: jest.fn().mockResolvedValue({
            text: 'Hello world from Whisper',
            language: 'en',
            duration: 2.5
          })
        }
      }
    }))
  };
});

describe('RT-VOICE-001: VoiceAgent Comprehensive Provider & Conversation Suite', () => {
  const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default and custom configuration', () => {
    const defaultAgent = new VoiceAgent();
    expect((defaultAgent as any).config.sttProvider).toBe('whisper');
    expect((defaultAgent as any).config.ttsProvider).toBe('native');

    const customAgent = new VoiceAgent({
      sttProvider: 'assemblyai',
      ttsProvider: 'elevenlabs',
      language: 'es',
      sampleRate: 24000,
      enableStreaming: false
    });
    expect((customAgent as any).config.language).toBe('es');
    expect((customAgent as any).config.sampleRate).toBe(24000);
  });

  it('transcribes audio using Whisper provider', async () => {
    const agent = new VoiceAgent({ sttProvider: 'whisper' });
    const result = await agent.transcribe(dummyAudio);

    expect(result.text).toBe('Hello world from Whisper');
    expect(result.confidence).toBe(0.9);
    expect(result.language).toBe('en');
    expect(result.duration).toBe(2.5);
  });

  it('transcribes audio using AssemblyAI provider', async () => {
    process.env.ASSEMBLYAI_API_KEY = 'test-assembly-key';
    mockedAxios.post.mockResolvedValueOnce({ data: { upload_url: 'https://upload.url' } } as any);
    mockedAxios.post.mockResolvedValueOnce({ data: { id: 'transcript-123' } } as any);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        status: 'completed',
        text: 'Hello from AssemblyAI',
        confidence: 0.95,
        words: [{ text: 'Hello', start: 0, end: 500, confidence: 0.95 }],
        audio_duration: 1.2
      }
    } as any);

    const agent = new VoiceAgent({ sttProvider: 'assemblyai' });
    const result = await agent.transcribe(dummyAudio);

    expect(result.text).toBe('Hello from AssemblyAI');
    expect(result.confidence).toBe(0.95);
  });

  it('throws error when AssemblyAI fails or key is missing', async () => {
    delete process.env.ASSEMBLYAI_API_KEY;
    const agent = new VoiceAgent({ sttProvider: 'assemblyai' });
    await expect(agent.transcribe(dummyAudio)).rejects.toThrow('ASSEMBLYAI_API_KEY not set');

    process.env.ASSEMBLYAI_API_KEY = 'test-key';
    mockedAxios.post.mockRejectedValueOnce(new Error('Network failure'));
    await expect(agent.transcribe(dummyAudio)).rejects.toThrow('Network failure');
  });

  it('throws error for unknown STT and TTS providers', async () => {
    const invalidStt = new VoiceAgent({ sttProvider: 'invalid-stt' as any });
    await expect(invalidStt.transcribe(dummyAudio)).rejects.toThrow('Unknown STT provider');

    const invalidTts = new VoiceAgent({ ttsProvider: 'invalid-tts' as any });
    await expect(invalidTts.synthesize('Hello')).rejects.toThrow('Unknown TTS provider');
  });

  it('synthesizes speech with native provider', async () => {
    const agent = new VoiceAgent({ ttsProvider: 'native' });
    const result = await agent.synthesize('Welcome to Antigravity');

    expect(result.audioBuffer).toBeInstanceOf(Buffer);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(16000);
  });

  it('synthesizes speech with ElevenLabs provider', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-eleven-key';
    mockedAxios.post.mockResolvedValueOnce({
      data: Buffer.from('fake-mp3-audio-bytes')
    } as any);

    const agent = new VoiceAgent({ ttsProvider: 'elevenlabs' });
    const result = await agent.synthesize('Hello ElevenLabs', 'voice-adam');

    expect(result.audioBuffer).toBeDefined();
    expect(result.sampleRate).toBe(22050);
  });

  it('throws error when ElevenLabs key is missing', async () => {
    delete process.env.ELEVENLABS_API_KEY;
    const agent = new VoiceAgent({ ttsProvider: 'elevenlabs' });
    await expect(agent.synthesize('Hello')).rejects.toThrow('ELEVENLABS_API_KEY not set');
  });

  it('synthesizes speech with Cartesia provider', async () => {
    process.env.CARTESIA_API_KEY = 'test-cartesia-key';
    mockedAxios.post.mockResolvedValueOnce({
      data: Buffer.from('fake-cartesia-bytes')
    } as any);

    const agent = new VoiceAgent({ ttsProvider: 'cartesia', sampleRate: 16000 });
    const result = await agent.synthesize('Hello Cartesia');

    expect(result.audioBuffer).toBeDefined();
    expect(result.sampleRate).toBe(16000);
  });

  it('processes full voice query with conversation lifecycle', async () => {
    const agent = new VoiceAgent({ sttProvider: 'whisper', ttsProvider: 'native' });
    const convId = agent.startConversation();
    expect(agent.getActiveConversationCount()).toBe(1);

    const queryHandler = jest.fn().mockResolvedValue('Here is your answer.');

    const result = await agent.processVoiceQuery(dummyAudio, queryHandler, convId);

    expect(queryHandler).toHaveBeenCalledWith('Hello world from Whisper');
    expect(result.text).toBe('Here is your answer.');
    expect(result.audio).toBeDefined();

    // Verify conversation tracking
    const conversation = agent.getConversation(convId);
    expect(conversation).toBeDefined();
    expect(conversation?.turns).toHaveLength(2);
    expect(conversation?.turns[0].role).toBe('user');
    expect(conversation?.turns[1].role).toBe('assistant');

    agent.endConversation(convId);
    expect(agent.getActiveConversationCount()).toBe(0);
  });
});
