/**
 * Local Model Layer & Resource Adapter Evaluation Suite (PX-07)
 */

import axios from 'axios';
import {
  LocalResourceMonitor,
  PicchioModelAdapter,
  ExternalLocalModelAdapter,
  LocalHardwareCanary
} from '../index';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Local Model & Resource Adapter Layer (PX-07)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PX07-T06: LocalResourceMonitor', () => {
    it('samples CPU, RAM, and hardware metrics safely without administrative privilege', () => {
      const monitor = new LocalResourceMonitor({ vramOverrideMb: 16384 });
      const metrics = monitor.sampleMetrics();

      expect(metrics.cpuCount).toBeGreaterThan(0);
      expect(metrics.totalRamMb).toBeGreaterThan(0);
      expect(metrics.freeRamMb).toBeGreaterThan(0);
      expect(metrics.ramUsagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.ramUsagePercent).toBeLessThanOrEqual(100);
      expect(metrics.estimatedVramTotalMb).toBe(16384);
      expect(metrics.estimatedVramFreeMb).toBe(Math.round(16384 * 0.8));
    });
  });

  describe('PX07-T04: Picchio External MoE Adapter', () => {
    it('enforces single-request concurrency and exposes hardware requirement notices', () => {
      const adapter = new PicchioModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'picchio-moe-8x7b',
        minimumRamMb: 16384,
        minimumDiskMb: 40960,
        diskStreamPath: 'C:\\Models\\picchio'
      });

      const summary = adapter.getRequirementsSummary();
      expect(summary.concurrencyModel).toBe('serialized_single_request');
      expect(summary.minimumRamMb).toBe(16384);
      expect(summary.minimumDiskMb).toBe(40960);
      expect(summary.licenseNotice).toContain('Picchio is operated separately');
    });

    it('executes generation through serialized MoE pipeline', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'MoE generation response',
                reasoning_content: 'Step 1: Activated expert 3 and 5.'
              }
            }
          ],
          usage: { total_tokens: 45 }
        }
      });

      mockedAxios.create.mockReturnValue({
        post: mockPost,
        get: jest.fn()
      } as any);

      const adapter = new PicchioModelAdapter({
        baseUrl: 'http://127.0.0.1:8080/v1',
        model: 'picchio-moe-8x7b'
      });

      const response = await adapter.generate({
        prompt: 'Solve equation with MoE'
      });

      expect(response.content).toBe('MoE generation response');
      expect((response as any).reasoning).toBe('Step 1: Activated expert 3 and 5.');
    });
  });

  describe('PX07-T01: Extended OpenAI-Compatible Local Endpoint Features', () => {
    it('supports tools schemas and tool_calls in local response', async () => {
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: { name: 'get_weather', arguments: '{"location": "Tokyo"}' }
                  }
                ]
              }
            }
          ],
          usage: { total_tokens: 30 }
        }
      });

      mockedAxios.create.mockReturnValue({
        post: mockPost,
        get: jest.fn()
      } as any);

      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llama3:8b'
      });

      const response = await adapter.generate({
        prompt: 'What is the weather in Tokyo?',
        tools: [
          {
            type: 'function',
            function: { name: 'get_weather', parameters: { type: 'object' } }
          }
        ]
      } as any);

      expect((response as any).toolCalls).toBeDefined();
      expect((response as any).toolCalls[0].function.name).toBe('get_weather');
    });

    it('formats multimodal image parts when images are provided', async () => {
      let sentBody: any;
      const mockPost = jest.fn().mockImplementation((_url, body) => {
        sentBody = body;
        return Promise.resolve({
          data: {
            choices: [{ message: { content: 'Detected a cat in the image.' } }],
            usage: { total_tokens: 120 }
          }
        });
      });

      mockedAxios.create.mockReturnValue({
        post: mockPost,
        get: jest.fn()
      } as any);

      const adapter = new ExternalLocalModelAdapter({
        baseUrl: 'http://127.0.0.1:11434',
        model: 'llava:13b'
      });

      const response = await adapter.generate({
        prompt: 'Describe this image',
        images: ['base64_encoded_image_bytes']
      } as any);

      expect(response.content).toBe('Detected a cat in the image.');
      expect(sentBody.messages[0].content).toEqual([
        { type: 'text', text: 'Describe this image' },
        { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,base64_encoded_image_bytes' } }
      ]);
    });
  });

  describe('PX07-T09: Local Hardware Canary Matrix', () => {
    it('runs local diagnostic canary matrix safely', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        data: {
          data: [{ id: 'llama3' }]
        }
      });
      const mockPost = jest.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Canary OK' } }],
          usage: { total_tokens: 10 }
        }
      });

      mockedAxios.create.mockReturnValue({
        get: mockGet,
        post: mockPost
      } as any);

      const canary = new LocalHardwareCanary({
        endpoint: 'http://127.0.0.1:11434/v1',
        model: 'llama3'
      });

      const result = await canary.runCanary();
      expect(result.passed).toBe(true);
      expect(result.hardwareDetected.online).toBe(true);
      expect(result.resourceManagerLease.passed).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
