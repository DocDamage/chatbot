/**
 * Orchestrator - Coordinates the request flow
 * Client → Gateway → Router/Orchestrator → Contract Gate → State Snapshot → (RAG + Memory) → Specialist Agent → Validators → Response
 */

import { AIContract, DEFAULT_CONTRACT } from '../../types/contract';
import { IntentRouter } from '../router/IntentRouter';
import { ContractGate } from '../contracts/ContractGate';
import { MemoryService } from '../memory/MemoryService';
import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { ImageAdapter, ImageGenerateOptions } from '../providers/StableDiffusionAdapter';
import { ValidationPipeline } from '../validator/Validators';
import { ProvenanceLedger } from '../provenance/ProvenanceLedger';
import { ArtifactType } from '../../types/provenance';
import { logger } from '../observability/logger';
import { CacheManager } from '../../utils/cache';
import { metricsCollector } from '../observability/metrics';
import { v4 as uuidv4 } from 'uuid';

export interface ChatRequest {
  message: string;
  sessionId: string;
  userId?: string;
  contract?: AIContract;
}

export interface ChatResponse {
  response: string;
  artifactId: string;
  contractVersion: string;
  latency: number;
  model: string;
  warnings?: string[];
  image?: string; // Base64 encoded image if image generation was requested
  imageUrl?: string;
}

export class Orchestrator {
  private intentRouter: IntentRouter;
  private contractGate: ContractGate;
  private memoryService: MemoryService;
  private llmAdapter: LLMAdapter;
  private imageAdapter?: ImageAdapter;
  private validatorPipeline: ValidationPipeline;
  private provenanceLedger: ProvenanceLedger;
  private cache: CacheManager;

  constructor(llmAdapter: LLMAdapter, imageAdapter?: ImageAdapter) {
    this.intentRouter = new IntentRouter();
    this.contractGate = new ContractGate();
    this.memoryService = new MemoryService();
    this.llmAdapter = llmAdapter;
    this.imageAdapter = imageAdapter;
    this.validatorPipeline = new ValidationPipeline();
    this.provenanceLedger = new ProvenanceLedger();
    this.cache = new CacheManager(3600); // 1 hour TTL
  }

  async processRequest(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const contract = request.contract || DEFAULT_CONTRACT;

    // 1. Check if this is an image generation request
    const isImageRequest = this.isImageGenerationRequest(request.message);
    
    // 2. Intent Classification
    const intent = this.intentRouter.classifyIntent(request.message);
    logger.info('Intent classified', { intent: intent.intent, confidence: intent.confidence, isImageRequest });

    // 2. Contract Gate Validation
    const gateCheck = this.contractGate.validateRequest(
      contract,
      'GENERAL_QUERY',
      undefined,
      this.llmAdapter.estimateCost({ prompt: request.message })
    );

    if (!gateCheck.allowed) {
      throw new Error(`Request blocked by contract gate: ${gateCheck.reason}`);
    }

    // 3. Check cache
    const cacheKey = this.cache.generateKey(request.message, request.sessionId);
    const cached = this.cache.get<ChatResponse>(cacheKey);
    if (cached) {
      logger.info('Cache hit', { cacheKey });
      metricsCollector.recordCacheHit(true);
      metricsCollector.recordRequest(true, intent.intent);
      metricsCollector.recordLatency(Date.now() - startTime);
      return cached;
    }
    metricsCollector.recordCacheHit(false);

    // 4. Handle image generation if requested
    if (isImageRequest && this.imageAdapter) {
      return await this.handleImageGeneration(request, contract, startTime);
    }

    // 5. Build context from memory
    const memoryContext = this.memoryService.getMemoryContext(request.sessionId);
    const contextSummary = this.memoryService.summarizeMemories(request.sessionId);

    // 6. Build prompt with context
    const systemPrompt = this.buildSystemPrompt(contract, contextSummary);
    const userPrompt = this.buildUserPrompt(request.message, memoryContext);

    // 7. Generate response with retry logic (and optionally generate image in parallel)
    const shouldGenerateImage = this.shouldGenerateImage(request.message);
    const imagePromise = shouldGenerateImage && this.imageAdapter 
      ? this.generateImage(request.message)
      : Promise.resolve(null);
    let response: string;
    let validationResult;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      attempts++;
      
      try {
        const llmOptions: LLMGenerateOptions = {
          prompt: userPrompt,
          systemPrompt,
          temperature: 0.7,
          maxTokens: 1000
        };

        const llmResponse = await this.llmAdapter.generate(llmOptions);

        // 7. Validate response
        validationResult = this.validatorPipeline.validate(llmResponse.content);
        
        if (validationResult.valid) {
          response = llmResponse.content;
          
          // 8. Wait for image generation if requested (runs in parallel)
          const imageResult = await imagePromise;
          
          // 9. Create provenance record
          const artifactId = uuidv4();
          this.provenanceLedger.createRecord(
            artifactId,
            ArtifactType.RESPONSE,
            response,
            contract,
            llmResponse.model,
            { temperature: 0.7, maxTokens: 1000 },
            'system'
          );

          // 10. Store in memory
          this.memoryService.addSessionMemory(request.sessionId, {
            content: `User: ${request.message}\nAssistant: ${response}`,
            turn_number: 0,
            metadata: {
              salience: 1.0
            }
          });

          // 11. Cache response
          const chatResponse: ChatResponse = {
            response,
            artifactId,
            contractVersion: contract.version,
            latency: Date.now() - startTime,
            model: llmResponse.model,
            warnings: validationResult.warnings,
            image: imageResult?.image,
            imageUrl: imageResult?.imageUrl
          };

          this.cache.set(cacheKey, chatResponse, 3600); // Cache for 1 hour

          // Record metrics
          metricsCollector.recordRequest(true, intent.intent);
          metricsCollector.recordLatency(chatResponse.latency);

          logger.info('Request processed successfully', {
            sessionId: request.sessionId,
            latency: chatResponse.latency,
            model: llmResponse.model
          });

          return chatResponse;
        } else {
          logger.warn('Validation failed, retrying', {
            attempt: attempts,
            errors: validationResult.errors
          });
        }
      } catch (error: any) {
        logger.error('LLM generation failed', { error: error.message, attempt: attempts });
        
        if (attempts >= maxRetries) {
          // Fallback to template response
          metricsCollector.recordError('LLM_GENERATION_FAILED');
          metricsCollector.recordRequest(false, intent.intent);
          response = "I'm having trouble processing that request right now. Could you try rephrasing?";
          const artifactId = uuidv4();
          
          return {
            response,
            artifactId,
            contractVersion: contract.version,
            latency: Date.now() - startTime,
            model: 'fallback',
            warnings: ['Used fallback response due to errors']
          };
        }
      }
    }

    throw new Error('Failed to generate valid response after retries');
  }

  private buildSystemPrompt(contract: AIContract, contextSummary: string): string {
    return `You are a helpful AI assistant. You can answer questions, engage in conversation, and provide information on a wide variety of topics.

Context from previous conversation: ${contextSummary}

Guidelines:
- Be helpful, accurate, and concise
- If you don't know something, say so
- Maintain a friendly and professional tone
- Contract version: ${contract.version}`;
  }

  private buildUserPrompt(message: string, memoryContext: any): string {
    // In a full implementation, this would build a rich context prompt
    return message;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Check if message is requesting image generation
   */
  private isImageGenerationRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const imageKeywords = [
      'generate image', 'create image', 'draw', 'paint', 'picture',
      'image of', 'show me', 'make an image', 'generate a picture',
      'create a picture', 'visualize', 'illustrate'
    ];
    return imageKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Determine if we should generate an image alongside the text response
   */
  private shouldGenerateImage(message: string): boolean {
    // Generate image if explicitly requested or if context suggests it
    return this.isImageGenerationRequest(message);
  }

  /**
   * Generate image from prompt
   */
  private async generateImage(prompt: string): Promise<{ image: string; imageUrl?: string } | null> {
    if (!this.imageAdapter) {
      return null;
    }

    try {
      // Extract image prompt from the message
      const imagePrompt = this.extractImagePrompt(prompt);
      
      const imageResponse = await this.imageAdapter.generate({
        prompt: imagePrompt,
        width: 512,
        height: 512,
        steps: 20,
        guidanceScale: 7.5
      });

      logger.info('Image generated successfully', { 
        model: imageResponse.model,
        latency: imageResponse.latency 
      });

      return {
        image: imageResponse.image,
        imageUrl: imageResponse.imageUrl
      };
    } catch (error: any) {
      logger.error('Image generation failed', { error: error.message });
      return null; // Don't fail the whole request if image generation fails
    }
  }

  /**
   * Extract image prompt from user message
   */
  private extractImagePrompt(message: string): string {
    // Remove common image generation trigger phrases
    let prompt = message
      .replace(/\b(generate|create|make|draw|paint|show me|image of|picture of)\s+/gi, '')
      .replace(/\b(an image|a picture|an illustration)\s+/gi, '')
      .trim();

    // If prompt is too short, use the original message
    if (prompt.length < 10) {
      prompt = message;
    }

    return prompt;
  }

  /**
   * Handle pure image generation request
   */
  private async handleImageGeneration(
    request: ChatRequest,
    contract: AIContract,
    startTime: number
  ): Promise<ChatResponse> {
    if (!this.imageAdapter) {
      throw new Error('Image generation requested but no image adapter configured');
    }

    try {
      const imagePrompt = this.extractImagePrompt(request.message);
      const imageResponse = await this.imageAdapter.generate({
        prompt: imagePrompt,
        width: 512,
        height: 512,
        steps: 20,
        guidanceScale: 7.5
      });

      // Also generate a text description using LLM
      const textResponse = await this.llmAdapter.generate({
        prompt: `Describe this image prompt: ${imagePrompt}`,
        systemPrompt: 'You are a helpful assistant that describes image generation prompts.',
        maxTokens: 200
      });

      const artifactId = uuidv4();
      this.provenanceLedger.createRecord(
        artifactId,
        ArtifactType.RESPONSE,
        textResponse.content,
        contract,
        imageResponse.model,
        { prompt: imagePrompt },
        'system'
      );

      return {
        response: `Generated an image: ${textResponse.content}`,
        artifactId,
        contractVersion: contract.version,
        latency: Date.now() - startTime,
        model: imageResponse.model,
        image: imageResponse.image,
        imageUrl: imageResponse.imageUrl
      };
    } catch (error: any) {
      logger.error('Image generation failed', { error: error.message });
      throw error;
    }
  }
}

