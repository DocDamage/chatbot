/**
 * Vision Adapter - Vision model integration
 * Research: Stanford Chatbot Arena Vision Leaderboard, MIT Vision Group
 */

import OpenAI from 'openai';
import { VisionRequest, VisionResponse, ImageAnalysis, MultiImageRequest } from '../../types/vision';
import { logger } from '../observability/logger';

export interface VisionAdapter {
  analyzeImage(request: VisionRequest): Promise<VisionResponse>;
  analyzeMultiImage(request: MultiImageRequest): Promise<VisionResponse>;
  extractText(image: string): Promise<string>; // OCR
}

/**
 * Get available free vision models
 */
export function getFreeVisionModels(): Array<{ id: string; name: string; description: string; requires: string }> {
  return [
    {
      id: 'llava',
      name: 'LLaVA (via Ollama)',
      description: 'Free, local vision model - requires Ollama with LLaVA model',
      requires: 'ollama pull llava'
    },
    {
      id: 'llava-llama3',
      name: 'LLaVA Llama 3 (via Ollama)',
      description: 'Free, local vision model with Llama 3 - requires Ollama',
      requires: 'ollama pull llava:llama3'
    }
  ];
}

/**
 * GPT-4V Adapter
 */
export class GPT4VAdapter implements VisionAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-vision-preview') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              {
                type: 'image_url',
                image_url: {
                  url: request.image.startsWith('data:') 
                    ? request.image 
                    : `data:image/jpeg;base64,${request.image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = this.estimateCost(tokensUsed);
      const latency = Date.now() - startTime;

      logger.info('Vision analysis completed', {
        model: this.model,
        tokensUsed,
        latency
      });

      return {
        content,
        model: this.model,
        tokensUsed,
        cost,
        latency,
        imageAnalysis: {
          description: content,
          objects: []
        }
      };
    } catch (error: any) {
      logger.error('Vision analysis failed', { error: error.message });
      throw error;
    }
  }

  async analyzeMultiImage(request: MultiImageRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      const content: any[] = [
        { type: 'text', text: request.prompt }
      ];

      // Add all images
      for (const image of request.images) {
        content.push({
          type: 'image_url',
          image_url: {
            url: image.startsWith('data:') 
              ? image 
              : `data:image/jpeg;base64,${image}`
          }
        });
      }

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content
          }
        ],
        max_tokens: 1500
      });

      const text = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;
      const cost = this.estimateCost(tokensUsed);
      const latency = Date.now() - startTime;

      return {
        content: text,
        model: this.model,
        tokensUsed,
        cost,
        latency
      };
    } catch (error: any) {
      logger.error('Multi-image analysis failed', { error: error.message });
      throw error;
    }
  }

  async extractText(image: string): Promise<string> {
    const response = await this.analyzeImage({
      image,
      prompt: 'Extract all text from this image. Return only the text content, no explanations.'
    });
    return response.content;
  }

  private estimateCost(tokens: number): number {
    // GPT-4V pricing (rough estimate)
    return (tokens / 1000) * 0.01; // $0.01 per 1K tokens
  }
}

/**
 * LLaVA Adapter - Free vision model via Ollama
 */
export class LLaVAAdapter implements VisionAdapter {
  private ollamaUrl: string;
  private model: string;
  private axios: any;

  constructor(ollamaUrl: string = 'http://localhost:11434', model: string = 'llava') {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
    this.axios = require('axios');
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      // Ollama LLaVA supports vision
      const response = await this.axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt: request.prompt,
          images: [request.image.startsWith('data:') 
            ? request.image.split(',')[1]
            : request.image],
          stream: false
        }
      );

      const content = response.data.response || '';
      const latency = Date.now() - startTime;

      logger.info('LLaVA vision analysis completed', {
        model: this.model,
        latency
      });

      return {
        content,
        model: this.model,
        latency,
        imageAnalysis: {
          description: content,
          objects: []
        }
      };
    } catch (error: any) {
      logger.error('LLaVA vision analysis failed', { error: error.message });
      throw error;
    }
  }

  async analyzeMultiImage(request: MultiImageRequest): Promise<VisionResponse> {
    // LLaVA via Ollama supports multiple images
    const startTime = Date.now();

    try {
      const images = request.images.map(img => 
        img.startsWith('data:') ? img.split(',')[1] : img
      );

      const response = await this.axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.model,
          prompt: request.prompt,
          images: images,
          stream: false
        }
      );

      return {
        content: response.data.response || '',
        model: this.model,
        latency: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('LLaVA multi-image analysis failed', { error: error.message });
      throw error;
    }
  }

  async extractText(image: string): Promise<string> {
    const response = await this.analyzeImage({
      image,
      prompt: 'Extract all text from this image. Return only the text content.'
    });
    return response.content;
  }
}

/**
 * Gemini Vision Adapter - Using Google Generative AI SDK
 */
export class GeminiVisionAdapter implements VisionAdapter {
  private apiKey: string;
  private model: string;
  private axios: any;

  constructor(apiKey: string, model: string = 'gemini-pro-vision') {
    this.apiKey = apiKey;
    this.model = model;
    this.axios = require('axios');
  }

  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      // Use Gemini API
      const response = await this.axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [
              { text: request.prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: request.image.startsWith('data:') 
                    ? request.image.split(',')[1]
                    : request.image
                }
              }
            ]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.candidates[0]?.content?.parts[0]?.text || '';
      const latency = Date.now() - startTime;

      logger.info('Gemini vision analysis completed', {
        model: this.model,
        latency
      });

      return {
        content,
        model: this.model,
        latency,
        imageAnalysis: {
          description: content,
          objects: []
        }
      };
    } catch (error: any) {
      logger.error('Gemini vision analysis failed', { error: error.message });
      throw error;
    }
  }

  async analyzeMultiImage(request: MultiImageRequest): Promise<VisionResponse> {
    const startTime = Date.now();

    try {
      const parts: any[] = [{ text: request.prompt }];
      
      for (const image of request.images) {
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: image.startsWith('data:') ? image.split(',')[1] : image
          }
        });
      }

      const response = await this.axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const content = response.data.candidates[0]?.content?.parts[0]?.text || '';
      const latency = Date.now() - startTime;

      return {
        content,
        model: this.model,
        latency
      };
    } catch (error: any) {
      logger.error('Gemini multi-image analysis failed', { error: error.message });
      throw error;
    }
  }

  async extractText(image: string): Promise<string> {
    const response = await this.analyzeImage({
      image,
      prompt: 'Extract all text from this image. Return only the text content, no explanations.'
    });
    return response.content;
  }
}

