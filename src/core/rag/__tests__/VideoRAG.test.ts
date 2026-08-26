import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { VideoRAG } from '../VideoRAG';

describe('RT-RAG-005: VideoRAG Frame Analysis and Multimodal Indexing Suite', () => {
  let tempDir: string;
  let sampleVideoFile: string;
  let videoRag: VideoRAG;
  let mockVoiceAgent: any;
  let mockEmbeddingService: any;
  let mockVisionService: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-rag-test-'));
    sampleVideoFile = path.join(tempDir, 'sample_video.mp4');
    fs.writeFileSync(sampleVideoFile, Buffer.from('ftypmp42....moov'));

    mockVoiceAgent = {
      transcribe: jest.fn<any>().mockResolvedValue({
        text: 'This video demonstrates assembling custom pixel art character animations.',
        duration: 60,
        words: []
      })
    };

    mockEmbeddingService = {
      embed: jest.fn<any>().mockResolvedValue([0.2, 0.4, 0.6])
    };

    mockVisionService = {
      describe: jest.fn<any>().mockResolvedValue('A pixel art character walk cycle sheet')
    };

    videoRag = new VideoRAG(mockVoiceAgent, mockEmbeddingService, mockVisionService, {
      frameInterval: 10,
      chunkDuration: 20,
      useVision: true,
      tempDir
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('indexes video files, analyzes keyframes, and searches video content', async () => {
    const doc = await videoRag.indexVideo(sampleVideoFile, { title: 'Animation Demo' });
    expect(doc.id).toBeDefined();
    expect(doc.transcript).toContain('pixel art character');
    expect(doc.chunks.length).toBeGreaterThan(0);

    // Simulate keyframe file with description
    const frameFile = path.join(tempDir, `${doc.id}_frame_0.jpg`);
    fs.writeFileSync(frameFile, Buffer.from('jpeg-data'));
    doc.frames.push({
      id: `${doc.id}_frame_0`,
      timestamp: 0,
      imagePath: frameFile,
      description: 'Intro frame showing title'
    });
    doc.chunks[0].frames.push(`${doc.id}_frame_0`);

    const results = await videoRag.search('walk cycle animation');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.id).toBe(doc.id);

    const list = videoRag.listDocuments();
    expect(list).toHaveLength(1);

    expect(videoRag.getDocument(doc.id)).toBeDefined();
    expect(videoRag.getDocument('unknown-id')).toBeUndefined();

    // Query answering
    const mockLlm = jest.fn<any>().mockResolvedValue('The video shows a character animation sheet.');
    const queryRes = await videoRag.query('what does the video show?', mockLlm);
    expect(queryRes.answer).toContain('character animation sheet');
    expect(queryRes.sources.length).toBeGreaterThan(0);

    // Remove document
    expect(videoRag.removeDocument('non-existent')).toBe(false);
    const deleted = videoRag.removeDocument(doc.id);
    expect(deleted).toBe(true);
    expect(videoRag.listDocuments()).toHaveLength(0);

    // Query when no docs exist
    const emptyQueryRes = await videoRag.query('anything?', mockLlm);
    expect(emptyQueryRes.answer).toContain('No relevant video content found');
  });
});
