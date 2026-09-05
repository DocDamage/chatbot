import axios from 'axios';
import { UniversalLLM } from '../UniversalLLM';
import { StableDiffusionAdapter } from '../StableDiffusionAdapter';
import { OllamaAdapter } from '../OllamaAdapter';
import { HuggingFaceAdapter } from '../HuggingFaceAdapter';
import {
  GPT4VAdapter,
  LLaVAAdapter,
  GeminiVisionAdapter,
  getFreeVisionModels,
} from '../VisionAdapter';
import { DeviceAdapter } from '../DeviceAdapter';
import { TemplateAdapter, OpenAIAdapter } from '../LLMAdapter';

jest.unmock('../OllamaAdapter');
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('B75-05: Providers Deep Decision Matrix', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('UniversalLLM', () => {
    it('initializes with Ollama when available and configures primary adapter', async () => {
      const mockAxiosInstance = {
        get: jest.fn().mockResolvedValue({
          data: {
            models: [
              { name: 'qwen3:8b' },
              { name: 'llama3:8b' },
              { name: 'mistral:7b' },
              { name: 'phi:3' },
            ],
          },
        }),
        post: jest.fn().mockResolvedValue({
          data: { response: 'Ollama answer', eval_count: 25 },
        }),
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const llm = new UniversalLLM({ preferFree: true });
      const init = await llm.initialize();

      expect(init.available.length).toBeGreaterThan(0);
      expect(init.primary).toBe('ollama:qwen3:8b');
      expect(llm.getAvailableProviders()).toContain('ollama');

      const response = await llm.generate({ prompt: 'Hello Ollama' });
      expect(response.content).toBe('Ollama answer');
      expect(response.tokensUsed).toBe(25);
    });

    it('initializes with HuggingFace when API key is set', async () => {
      process.env.HUGGINGFACE_API_KEY = 'hf_test_key_123';
      const mockAxiosInstance = {
        get: jest.fn().mockRejectedValue(new Error('Connection refused')),
        post: jest.fn(),
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
      (axios.post as jest.Mock).mockResolvedValue({
        data: [{ generated_text: 'HF answer' }],
      });

      const llm = new UniversalLLM({ preferFree: true });
      const init = await llm.initialize();

      expect(init.available).toContain('huggingface:mistralai/Mistral-7B-Instruct-v0.2');
      const response = await llm.generate({ prompt: 'Hello HF' });
      expect(response.content).toBe('HF answer');
    });

    it('initializes with OpenAI when configured and fallback to template when no keys', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Connection refused')),
        post: jest.fn(),
      } as any);
      delete process.env.HUGGINGFACE_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const llm = new UniversalLLM({ preferFree: false, fallbackToTemplate: true });
      const init = await llm.initialize();

      expect(init.available).toContain('template');
      expect(init.primary).toBe('template');

      const handler = llm.getHandler();
      const answer = await handler('What is 2+2?');
      expect(answer).toBeDefined();
    });

    it('falls back across adapters when primary adapter fails', async () => {
      const llm = new UniversalLLM({ fallbackToTemplate: false, timeout: 5000 });

      const failingAdapter = {
        generate: jest.fn().mockRejectedValue(new Error('Network error')),
        estimateCost: () => 0,
        getModelName: () => 'failing_model',
      };
      const workingAdapter = {
        generate: jest
          .fn()
          .mockResolvedValue({ content: 'Fallback response', model: 'working_model' }),
        estimateCost: () => 0,
        getModelName: () => 'working_model',
      };

      llm.registerAdapter('failing', failingAdapter as any, true);
      llm.registerAdapter('working', workingAdapter as any, false);

      const result = await llm.generate({ prompt: 'test' });
      expect(result.content).toBe('Fallback response');
      expect(failingAdapter.generate).toHaveBeenCalled();
      expect(workingAdapter.generate).toHaveBeenCalled();
    });

    it('handles generateWith, setPrimaryAdapter, and errors', async () => {
      const llm = new UniversalLLM();
      const customAdapter = {
        generate: jest.fn().mockResolvedValue({ content: 'Custom result', model: 'custom' }),
        estimateCost: () => 0,
        getModelName: () => 'custom',
      };

      llm.registerAdapter('custom', customAdapter as any);
      expect(llm.setPrimaryAdapter('custom')).toBe(true);
      expect(llm.setPrimaryAdapter('non_existent')).toBe(false);
      expect(llm.getPrimaryAdapter()?.getModelName()).toBe('custom');

      const res = await llm.generateWith('custom', { prompt: 'hi' });
      expect(res.content).toBe('Custom result');

      await expect(llm.generateWith('invalid_provider', { prompt: 'hi' })).rejects.toThrow(
        "Provider 'invalid_provider' not available"
      );
    });

    it('throws when all adapters fail', async () => {
      const llm = new UniversalLLM({ fallbackToTemplate: false, timeout: 100 });
      const failingAdapter = {
        generate: jest.fn().mockRejectedValue(new Error('Persistent crash')),
        estimateCost: () => 0,
        getModelName: () => 'broken',
      };

      llm.registerAdapter('broken', failingAdapter as any, true);
      await expect(llm.generate({ prompt: 'fail' })).rejects.toThrow('Persistent crash');
    });
  });

  describe('StableDiffusionAdapter', () => {
    it('generates images with full parameter set and estimates cost', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          images: ['base64_encoded_image_data_here'],
        },
      });
      mockedAxios.create.mockReturnValue({
        post: mockPost,
      } as any);

      const adapter = new StableDiffusionAdapter('http://localhost:7860', 'sd-xl');
      expect(adapter.getModelName()).toBe('stable-diffusion:sd-xl');
      expect(adapter.estimateCost({ prompt: 'test' })).toBe(0);

      const res = await adapter.generate({
        prompt: 'a majestic mountain landscape',
        negativePrompt: 'blurry, dark',
        width: 768,
        height: 768,
        steps: 30,
        guidanceScale: 8.0,
        seed: 12345,
      });

      expect(res.image).toBe('base64_encoded_image_data_here');
      expect(res.model).toBe('stable-diffusion:sd-xl');
      expect(res.cost).toBe(0);
      expect(mockPost).toHaveBeenCalledWith(
        '/sdapi/v1/txt2img',
        expect.objectContaining({
          prompt: 'a majestic mountain landscape',
          negative_prompt: 'blurry, dark',
          width: 768,
          height: 768,
          steps: 30,
          cfg_scale: 8.0,
          seed: 12345,
        })
      );
    });

    it('throws when no images are returned in response', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: { images: [] } }),
      } as any);

      const adapter = new StableDiffusionAdapter();
      await expect(adapter.generate({ prompt: 'empty' })).rejects.toThrow('No images generated');
    });

    it('handles connection refused error with clear instructions', async () => {
      const connError: any = new Error('connect ECONNREFUSED 127.0.0.1:7860');
      connError.code = 'ECONNREFUSED';

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(connError),
      } as any);

      const adapter = new StableDiffusionAdapter();
      await expect(adapter.generate({ prompt: 'test' })).rejects.toThrow(
        /Stable Diffusion service is not running/
      );
    });
  });

  describe('OllamaAdapter', () => {
    it('generates completions with systemPrompt and custom model', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          response: 'Ollama generated text',
          eval_count: 42,
        },
      });
      mockedAxios.create.mockReturnValue({
        post: mockPost,
        get: jest.fn().mockResolvedValue({ data: { models: [{ name: 'llama2' }] } }),
      } as any);

      const adapter = new OllamaAdapter('http://localhost:11434', 'llama2');
      expect(adapter.getModelName()).toBe('ollama:llama2');
      expect(adapter.estimateCost({ prompt: 'test' })).toBe(0);

      const res = await adapter.generate({
        prompt: 'Calculate 10+10',
        systemPrompt: 'You are a math tutor.',
        temperature: 0.5,
        maxTokens: 500,
        model: 'llama3:8b',
      });

      expect(res.content).toBe('Ollama generated text');
      expect(res.tokensUsed).toBe(42);
      expect(res.model).toBe('ollama:llama3:8b');
      expect(mockPost).toHaveBeenCalledWith(
        '/api/generate',
        expect.objectContaining({
          model: 'llama3:8b',
          prompt: 'You are a math tutor.\n\nUser: Calculate 10+10\nAssistant:',
          options: { temperature: 0.5, num_predict: 500 },
        })
      );
    });

    it('handles ECONNREFUSED error and checkAvailability failures', async () => {
      const connError: any = new Error('ECONNREFUSED');
      connError.code = 'ECONNREFUSED';

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(connError),
        get: jest.fn().mockRejectedValue(new Error('Offline')),
      } as any);

      const adapter = new OllamaAdapter();
      await expect(adapter.generate({ prompt: 'test' })).rejects.toThrow(/Ollama is not running/);

      const avail = await adapter.checkAvailability();
      expect(avail.available).toBe(false);
    });
  });

  describe('HuggingFaceAdapter', () => {
    it('generates text across array and object response formats', async () => {
      (axios.post as jest.Mock)
        .mockResolvedValueOnce({
          data: [{ generated_text: 'Response from array of objects' }],
        })
        .mockResolvedValueOnce({
          data: { generated_text: 'Response from single object' },
        })
        .mockResolvedValueOnce({
          data: [{ text: 'Response from text field' }],
        });

      const adapter = new HuggingFaceAdapter('hf_key_sample', 'custom/model');
      expect(adapter.getModelName()).toBe('custom/model');
      expect(adapter.estimateCost({ prompt: 'p' })).toBe(0);

      const r1 = await adapter.generate({ prompt: 'Prompt 1', systemPrompt: 'System 1' });
      expect(r1.content).toBe('Response from array of objects');

      const r2 = await adapter.generate({ prompt: 'Prompt 2' });
      expect(r2.content).toBe('Response from single object');

      const r3 = await adapter.generate({ prompt: 'Prompt 3' });
      expect(r3.content).toBe('Response from text field');

      expect(HuggingFaceAdapter.getFreeModels().length).toBeGreaterThan(0);
    });

    it('handles errors during generation', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce(new Error('HF Rate Limit Exceeded'));

      const adapter = new HuggingFaceAdapter(undefined);
      await expect(adapter.generate({ prompt: 'Prompt' })).rejects.toThrow(
        'HF Rate Limit Exceeded'
      );
    });
  });

  describe('VisionAdapter', () => {
    it('provides free vision models metadata', () => {
      const freeModels = getFreeVisionModels();
      expect(freeModels.length).toBeGreaterThan(0);
      expect(freeModels[0].id).toBe('llava');
    });

    it('exercises LLaVAAdapter analyzeImage, analyzeMultiImage, and extractText', async () => {
      const adapter = new LLaVAAdapter('http://localhost:11434', 'llava');
      (adapter as any).axios = {
        post: jest.fn().mockResolvedValue({
          data: { response: 'A golden retriever running in a park' },
        }),
      };

      const singleRes = await adapter.analyzeImage({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        prompt: 'What is in this image?',
      });
      expect(singleRes.content).toBe('A golden retriever running in a park');
      expect(singleRes.imageAnalysis?.description).toBe('A golden retriever running in a park');

      const multiRes = await adapter.analyzeMultiImage({
        images: ['data:image/png;base64,abc', 'rawbase64xyz'],
        prompt: 'Compare these two images',
      });
      expect(multiRes.content).toBe('A golden retriever running in a park');

      const textRes = await adapter.extractText('data:image/png;base64,abc');
      expect(textRes).toBe('A golden retriever running in a park');
    });

    it('exercises GeminiVisionAdapter analyzeImage, analyzeMultiImage, and extractText', async () => {
      const adapter = new GeminiVisionAdapter('gemini_test_key', 'gemini-1.5-flash');
      (adapter as any).axios = {
        post: jest.fn().mockResolvedValue({
          data: {
            candidates: [
              {
                content: { parts: [{ text: 'Gemini detected: Invoice total $450.00' }] },
              },
            ],
          },
        }),
      };

      const singleRes = await adapter.analyzeImage({
        image: 'rawbase64data',
        prompt: 'Read receipt',
      });
      expect(singleRes.content).toContain('Invoice total $450.00');

      const multiRes = await adapter.analyzeMultiImage({
        images: ['data:image/jpeg;base64,123', '456'],
        prompt: 'Summarize both',
      });
      expect(multiRes.content).toContain('Invoice total $450.00');

      const text = await adapter.extractText('rawbase64');
      expect(text).toContain('Invoice total $450.00');
    });
  });

  describe('DeviceAdapter', () => {
    it('handles device capabilities inspection and allocation', async () => {
      const device = new DeviceAdapter();
      const info = device.getDeviceInfo();
      expect(info).toBeDefined();
      expect(typeof info.totalMemory).toBe('number');
      expect(typeof info.freeMemory).toBe('number');
      expect(typeof info.cpuCores).toBe('number');

      const memStatus = device.getMemoryStatus();
      expect(memStatus.status).toBeDefined();
      expect(typeof memStatus.usagePercent).toBe('number');

      const rec = device.getModelRecommendation();
      expect(rec.quantization).toBeDefined();
      expect(rec.suggestedModels.length).toBeGreaterThan(0);
    });
  });
});
