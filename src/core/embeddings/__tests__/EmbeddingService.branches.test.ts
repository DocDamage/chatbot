import axios from 'axios';
import { EmbeddingService } from '../EmbeddingService';

jest.mock('axios', () => ({ post: jest.fn() }));

const axiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

describe('EmbeddingService branch matrix', () => {
  const originalTransformers = process.env.EMBEDDING_USE_TRANSFORMERS;

  beforeEach(() => {
    process.env.EMBEDDING_USE_TRANSFORMERS = 'false';
    axiosPost.mockReset();
  });

  afterAll(() => {
    if (originalTransformers === undefined) delete process.env.EMBEDDING_USE_TRANSFORMERS;
    else process.env.EMBEDDING_USE_TRANSFORMERS = originalTransformers;
  });

  it('uses deterministic local fallback for populated and empty text and supports batches', async () => {
    const service = new EmbeddingService(undefined, undefined, 'xenova');
    const populated = await service.embed('repeatable text');
    const empty = await service.generateEmbedding('');
    const batch = await service.embedBatch(['first', 'second']);

    expect(populated).toHaveLength(384);
    expect(Math.sqrt(populated.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1);
    expect(empty).toEqual(new Array(384).fill(0));
    expect(batch).toHaveLength(2);
  });

  it('uses an initialized local pipeline and falls back after pipeline failure', async () => {
    const service = new EmbeddingService();
    const pipeline = jest
      .fn()
      .mockResolvedValueOnce({ data: new Float32Array([0.25, 0.75]) })
      .mockRejectedValueOnce(new Error('pipeline failed'));
    (service as any).localPipeline = pipeline;

    await expect(service.embed('first')).resolves.toEqual([0.25, 0.75]);
    const fallback = await service.embed('second');
    expect(fallback).toHaveLength(384);
    expect((service as any).localPipeline).toBeUndefined();
  });

  it('uses OpenAI when configured and falls back locally when it is absent or fails', async () => {
    const service = new EmbeddingService();
    const create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 2, 3] }] });
    (service as any).openaiClient = { embeddings: { create } };

    await expect(service.embed('remote', { provider: 'openai', model: 'embedding-model' })).resolves.toEqual([1, 2, 3]);
    expect(create).toHaveBeenCalledWith({ model: 'embedding-model', input: 'remote' });

    (service as any).openaiClient = undefined;
    await expect(service.embed('fallback', { provider: 'openai' })).resolves.toHaveLength(384);

    (service as any).openaiClient = {
      embeddings: { create: jest.fn().mockRejectedValue(new Error('openai failed')) },
    };
    await expect(service.embed('fallback again', { provider: 'openai' })).resolves.toHaveLength(384);
  });

  it('uses Ollama responses and falls back locally after an Ollama error', async () => {
    const service = new EmbeddingService(undefined, 'http://ollama.test');
    axiosPost.mockResolvedValueOnce({ data: { embedding: [4, 5] } } as any);
    await expect(service.embed('ollama text', { provider: 'ollama', model: 'nomic' })).resolves.toEqual([4, 5]);
    expect(axiosPost).toHaveBeenCalledWith('http://ollama.test/api/embeddings', {
      model: 'nomic',
      prompt: 'ollama text',
    });

    axiosPost.mockRejectedValueOnce(new Error('ollama unavailable'));
    await expect(service.embed('fallback', { provider: 'ollama' })).resolves.toHaveLength(384);
  });

  it('covers the defensive default provider and every dimension mapping', async () => {
    const service = new EmbeddingService();
    await expect(service.embed('unknown', { provider: 'unexpected' as any })).resolves.toHaveLength(384);

    expect(service.getDimensions('openai')).toBe(1536);
    expect(service.getDimensions('xenova')).toBe(384);
    expect(service.getDimensions('ollama')).toBe(4096);
    expect(service.getDimensions('unexpected' as any)).toBe(384);
    expect(service.getDimensions()).toBe(384);
    expect(EmbeddingService.getFreeModels()).toHaveLength(5);
  });
});
