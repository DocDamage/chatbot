import {
  getFreeVisionModels,
  GPT4VAdapter,
  LLaVAAdapter,
  GeminiVisionAdapter
} from '../VisionAdapter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'A high resolution landscape with mountains.' } }],
            usage: { total_tokens: 150 }
          })
        }
      }
    }))
  };
});

describe('RT-VIS-001: VisionAdapter Multi-Provider Image Understanding Suite', () => {
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists free local vision models', () => {
    const models = getFreeVisionModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBe('llava');
  });

  it('analyzes single and multi-image requests with GPT-4V', async () => {
    const adapter = new GPT4VAdapter('test-key', 'gpt-4-vision-preview');

    // Single image
    const singleRes = await adapter.analyzeImage({
      prompt: 'Describe what you see in the photo',
      image: dummyBase64
    });
    expect(singleRes.content).toContain('mountains');
    expect(singleRes.model).toBe('gpt-4-vision-preview');
    expect(singleRes.tokensUsed).toBe(150);

    // Multi-image
    const multiRes = await adapter.analyzeMultiImage({
      prompt: 'Compare these two images',
      images: [dummyBase64, `data:image/png;base64,${dummyBase64}`]
    });
    expect(multiRes.content).toContain('mountains');

    // Text OCR extraction
    const ocrText = await adapter.extractText(dummyBase64);
    expect(ocrText).toContain('mountains');
  });

  it('analyzes images using LLaVAAdapter', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        response: 'Local LLaVA identified a cat on a couch.'
      }
    } as any);

    const llava = new LLaVAAdapter('http://localhost:11434', 'llava');
    const result = await llava.analyzeImage({
      prompt: 'What animal is present?',
      image: dummyBase64
    });

    expect(result.content).toContain('cat');
    expect(result.model).toBe('llava');

    // Multi image
    mockedAxios.post.mockResolvedValueOnce({
      data: { response: 'Both images contain animals.' }
    } as any);

    const multi = await llava.analyzeMultiImage({
      prompt: 'Compare animals',
      images: [dummyBase64, `data:image/png;base64,${dummyBase64}`]
    });
    expect(multi.content).toContain('animals');

    // Extract text
    mockedAxios.post.mockResolvedValueOnce({
      data: { response: 'Extracted text content' }
    } as any);
    const text = await llava.extractText(dummyBase64);
    expect(text).toBe('Extracted text content');
  });

  it('analyzes images using GeminiVisionAdapter', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        candidates: [{
          content: { parts: [{ text: 'Gemini detected technical architecture diagram.' }] }
        }]
      }
    } as any);

    const gemini = new GeminiVisionAdapter('gemini-key', 'gemini-pro-vision');
    const result = await gemini.analyzeImage({
      prompt: 'Explain diagram',
      image: `data:image/png;base64,${dummyBase64}`
    });

    expect(result.content).toContain('diagram');

    // Multi image
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        candidates: [{
          content: { parts: [{ text: 'Gemini comparison results.' }] }
        }]
      }
    } as any);

    const multi = await gemini.analyzeMultiImage({
      prompt: 'Compare',
      images: [dummyBase64, `data:image/png;base64,${dummyBase64}`]
    });
    expect(multi.content).toContain('comparison');

    // Extract text
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        candidates: [{
          content: { parts: [{ text: 'OCR text from Gemini' }] }
        }]
      }
    } as any);

    const text = await gemini.extractText(dummyBase64);
    expect(text).toBe('OCR text from Gemini');
  });
});
