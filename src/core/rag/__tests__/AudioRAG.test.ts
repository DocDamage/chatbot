import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AudioRAG } from '../AudioRAG';

describe('RT-RAG-004: AudioRAG Transcription and Time-Aligned Retrieval Suite', () => {
  let tempDir: string;
  let sampleAudioFile: string;
  let audioRag: AudioRAG;
  let mockVoiceAgent: any;
  let mockEmbeddingService: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-rag-test-'));
    sampleAudioFile = path.join(tempDir, 'sample_audio.wav');
    fs.writeFileSync(sampleAudioFile, Buffer.from('RIFF....WAVEfmt '));

    mockVoiceAgent = {
      transcribe: jest.fn<any>().mockResolvedValue({
        text: 'Welcome to the podcast. Today we talk about game engine development and shaders.',
        duration: 120,
        words: [
          { word: 'Welcome', start: 0.0, end: 0.5 },
          { word: 'podcast', start: 0.8, end: 1.2 },
          { word: 'shaders', start: 2.0, end: 2.5 }
        ]
      })
    };

    mockEmbeddingService = {
      embed: jest.fn<any>().mockResolvedValue([0.1, 0.2, 0.3])
    };

    audioRag = new AudioRAG(mockVoiceAgent, mockEmbeddingService, {
      chunkDuration: 30,
      chunkOverlap: 5,
      minChunkLength: 10,
      maxResults: 5
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('indexes audio files, generates time-aligned chunks, and lists indexed documents', async () => {
    const doc = await audioRag.indexAudio(sampleAudioFile, { title: 'Episode 1' });
    expect(doc.id).toBeDefined();
    expect(doc.transcript).toContain('game engine development');
    expect(doc.chunks.length).toBeGreaterThan(0);

    const list = audioRag.listDocuments();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(doc.id);
  });

  it('searches indexed audio chunks by semantic query and handles deletion', async () => {
    const doc = await audioRag.indexAudio(sampleAudioFile, { title: 'Episode 1' });

    const results = await audioRag.search('shaders and rendering');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.documentId).toBe(doc.id);

    const deleted = audioRag.removeDocument(doc.id);
    expect(deleted).toBe(true);
    expect(audioRag.listDocuments()).toHaveLength(0);
  });
});
