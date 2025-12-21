/**
 * Hugging Face Adapter - Free models via Hugging Face Inference API
 * Research: Hugging Face Transformers
 */

import axios from 'axios';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from './LLMAdapter';
import { logger } from '../observability/logger';

export class HuggingFaceAdapter implements LLMAdapter {
  private apiKey?: string;
  private model: string;
  private apiUrl: string;

  constructor(apiKey: string | undefined, model: string = 'mistralai/Mistral-7B-Instruct-v0.2') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = `https://api-inference.huggingface.co/models/${model}`;
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      // Build prompt
      let prompt = options.prompt;
      if (options.systemPrompt) {
        prompt = `${options.systemPrompt}\n\n${prompt}`;
      }

      const response = await axios.post(
        this.apiUrl,
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            return_full_text: false
          }
        },
        {
          headers,
          timeout: 60000
        }
      );

      // Handle different response formats
      let content: string;
      if (Array.isArray(response.data)) {
        content = response.data[0]?.generated_text || response.data[0]?.text || '';
      } else if (response.data.generated_text) {
        content = response.data.generated_text;
      } else {
        content = response.data[0]?.generated_text || '';
      }

      const latency = Date.now() - startTime;

      logger.info('Hugging Face generation completed', {
        model: this.model,
        latency
      });

      return {
        content: content.trim(),
        model: this.model,
        latency,
        cost: 0, // Free (with rate limits)
        tokensUsed: Math.ceil(content.length / 4) // Estimate
      };
    } catch (error: any) {
      logger.error('Hugging Face generation failed', {
        error: error.message,
        model: this.model
      });
      throw error;
    }
  }

  estimateCost(options: LLMGenerateOptions): number {
    return 0; // Free (with rate limits)
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Get available free models
   */
  static getFreeModels(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'mistralai/Mistral-7B-Instruct-v0.2',
        name: 'Mistral 7B Instruct',
        description: 'High-quality instruction-following model'
      },
      {
        id: 'meta-llama/Llama-2-7b-chat-hf',
        name: 'Llama 2 7B Chat',
        description: 'Meta\'s Llama 2 chat model'
      },
      {
        id: 'google/flan-t5-large',
        name: 'FLAN-T5 Large',
        description: 'Google\'s instruction-tuned T5'
      },
      {
        id: 'microsoft/Phi-3-mini-4k-instruct',
        name: 'Phi-3 Mini',
        description: 'Microsoft\'s efficient small model'
      },
      {
        id: 'HuggingFaceH4/zephyr-7b-beta',
        name: 'Zephyr 7B',
        description: 'Aligned chat model'
      }
    ];
  }
}

