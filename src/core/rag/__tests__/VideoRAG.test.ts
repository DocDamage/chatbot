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
      describeImage: jest.fn<any>().mockResolvedValue('A pixel art character walk cycle sheet')
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

    const results = await videoRag.search('walk cycle animation');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document.id).toBe(doc.id);

    const list = videoRag.listDocuments();
    expect(list).toHaveLength(1);

    const deleted = videoRag.removeDocument(doc.id);
    expect(deleted).toBe(true);
    expect(videoRag.listDocuments()).toHaveLength(0);
  });
});
