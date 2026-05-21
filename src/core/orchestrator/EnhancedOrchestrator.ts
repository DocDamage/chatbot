/**
 * Enhanced Orchestrator - Uses all Phase 1 features
 * Integrates: RAG, Model Routing, Safety Pipeline, Semantic Cache
 */

import { AIContract, DEFAULT_CONTRACT } from '../../types/contract';
import { IntentRouter } from '../router/IntentRouter';
import { ContractGate } from '../contracts/ContractGate';
import { MemoryService } from '../memory/MemoryService';
import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { ImageAdapter } from '../providers/StableDiffusionAdapter';
import { ValidationPipeline } from '../validator/Validators';
import { ProvenanceLedger } from '../provenance/ProvenanceLedger';
import { ArtifactType } from '../../types/provenance';
import { logger } from '../observability/logger';
import { metricsCollector } from '../observability/metrics';
import { v4 as uuidv4 } from 'uuid';

// Phase 1 imports
import { ModelRouter, ModelProvider, TaskType } from '../providers/ModelRouter';
import { EnsembleAdapter } from '../providers/EnsembleAdapter';
import { RAGService } from '../rag/RAGService';
import { SafetyPipeline } from '../safety/SafetyPipeline';
import { SemanticCache } from '../cache/SemanticCache';
import { ChatRequest, ChatResponse } from './Orchestrator';
import { ToolRegistry } from '../tools/ToolRegistry';
import { FunctionCaller } from '../tools/FunctionCaller';
import { CodingAgent } from '../agents/CodingAgent';
import { buildChatContextBundle, renderChatContext } from '../../types/chat';

export interface EnhancedOrchestratorConfig {
  useRAG?: boolean;
  useModelRouting?: boolean;
  useEnsemble?: boolean;
  useSafetyPipeline?: boolean;
  useSemanticCache?: boolean;
  ragService?: RAGService;
  modelRouter?: ModelRouter;
  safetyPipeline?: SafetyPipeline;
  semanticCache?: SemanticCache<ChatResponse>;
  toolRegistry?: ToolRegistry;
  functionCaller?: FunctionCaller;
  codingAgent?: CodingAgent;
  useToolCalling?: boolean;
}

export class EnhancedOrchestrator {
  private intentRouter: IntentRouter;
  private contractGate: ContractGate;
  private memoryService: MemoryService;
  private llmAdapter: LLMAdapter;
  private imageAdapter?: ImageAdapter;
  private validatorPipeline: ValidationPipeline;
  private provenanceLedger: ProvenanceLedger;
  
  // Phase 1 features
  private config: EnhancedOrchestratorConfig;
  private ragService?: RAGService;
  private modelRouter?: ModelRouter;
  private ensembleAdapter?: EnsembleAdapter;
  private safetyPipeline?: SafetyPipeline;
  private semanticCache?: SemanticCache<ChatResponse>;
  private codingAgent?: CodingAgent;

  constructor(
    llmAdapter: LLMAdapter,
    imageAdapter?: ImageAdapter,
    config: EnhancedOrchestratorConfig = {}
  ) {
    this.intentRouter = new IntentRouter();
    this.contractGate = new ContractGate();
    this.memoryService = new MemoryService();
    this.llmAdapter = llmAdapter;
    this.imageAdapter = imageAdapter;
    this.validatorPipeline = new ValidationPipeline();
    this.provenanceLedger = new ProvenanceLedger();
    this.config = config;

    // Initialize Phase 1 features
    this.initializePhase1Features();
  }

  /**
   * Initialize Phase 1 features based on config
   */
  private initializePhase1Features(): void {
    // RAG Service
    if (this.config.useRAG !== false) {
      this.ragService = this.config.ragService || new RAGService(this.llmAdapter);
      logger.info('RAG service enabled');
    }

    // Model Router
    if (this.config.useModelRouting !== false) {
      this.modelRouter = this.config.modelRouter || new ModelRouter();
      const configuredProvider = process.env.LLM_PROVIDER || 'template';
      const provider = this.llmAdapter.getModelName() === 'template'
        ? ModelProvider.TEMPLATE
        : configuredProvider === 'openai' || configuredProvider === 'openai-compatible'
          ? ModelProvider.OPENAI
          : configuredProvider === 'anthropic'
            ? ModelProvider.ANTHROPIC
            : configuredProvider === 'gemini'
              ? ModelProvider.GOOGLE
              : ModelProvider.OLLAMA;
      this.modelRouter.registerAdapter(provider, this.llmAdapter);
      // Register other adapters as needed
      
      if (this.config.useEnsemble) {
        this.ensembleAdapter = new EnsembleAdapter(this.modelRouter, true);
        logger.info('Model routing and ensemble enabled');
      } else {
        logger.info('Model routing enabled');
      }
    }

    // Safety Pipeline
    if (this.config.useSafetyPipeline !== false) {
      this.safetyPipeline = this.config.safetyPipeline || new SafetyPipeline(
        this.llmAdapter,
        this.ragService?.getRetriever()
      );
      logger.info('Safety pipeline enabled');
    }

    // Semantic Cache
    if (this.config.useSemanticCache !== false) {
      this.semanticCache = this.config.semanticCache || new SemanticCache<ChatResponse>(3600, 0.7);
      logger.info('Semantic cache enabled');
    }

    if (this.config.useToolCalling !== false) {
      this.codingAgent = this.config.codingAgent;
      if (this.codingAgent) {
        logger.info('Coding agent tool pipeline enabled');
      }
    }
  }

  /**
   * Process request with Phase 1 enhancements
   */
  async processRequest(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const contract = request.contract || DEFAULT_CONTRACT;

    // 1. Intent Classification
    const intent = this.intentRouter.classifyIntent(request.message);
    logger.info('Intent classified', { intent: intent.intent, confidence: intent.confidence });

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

    // 3. Check semantic cache
    if (this.semanticCache) {
      const cached = this.semanticCache.get(request.message);
      if (cached) {
        logger.info('Semantic cache hit');
        metricsCollector.recordCacheHit(true);
        metricsCollector.recordRequest(true, intent.intent);
        metricsCollector.recordLatency(Date.now() - startTime);
        return cached;
      }
    }
    metricsCollector.recordCacheHit(false);

    // 4. Determine task type for model routing
    const taskType = this.inferTaskType(request.message);

    if (taskType === TaskType.CODE_GENERATION && this.codingAgent) {
      const codingResult = await this.codingAgent.handle({
        message: request.message,
        runVerification: false,
        context: buildChatContextBundle(request)
      });
      const artifactId = uuidv4();
      const response = this.formatCodingResponse(codingResult);
      return {
        response,
        artifactId,
        contractVersion: contract.version,
        latency: Date.now() - startTime,
        model: 'coding-agent',
        warnings: codingResult.risks
      };
    }

    // 5. Select model (if routing enabled)
    let adapter = this.llmAdapter;
    let selectedModel = 'default';
    if (this.modelRouter && !this.ensembleAdapter) {
      try {
        const { adapter: routedAdapter, selection } = await this.modelRouter.route(
          taskType,
          { prompt: request.message },
          contract.max_cost_per_request
        );
        adapter = routedAdapter;
        selectedModel = routedAdapter.getModelName();
        logger.info('Model routed', { model: selectedModel, confidence: selection.confidence });
      } catch (error: any) {
        logger.warn('Model routing failed, using default', { error: error.message });
      }
    } else if (this.ensembleAdapter) {
      adapter = this.ensembleAdapter;
      selectedModel = 'ensemble';
    }

    // 6. Parallelize RAG retrieval and memory context building
    let ragContext = '';
    let citations: any[] = [];
    const [ragResult, memoryContext, contextSummary] = await Promise.all([
      // RAG retrieval (if enabled)
      this.ragService && this.shouldUseRAG(request.message)
        ? this.ragService.processQuery(request.message, false).catch((error: any) => {
            logger.warn('RAG retrieval failed', { error: error.message });
            return null;
          })
        : Promise.resolve(null),
      // Memory context (parallel)
      Promise.resolve(this.memoryService.getMemoryContext(request.sessionId)),
      // Memory summary (parallel)
      Promise.resolve(this.memoryService.summarizeMemories(request.sessionId))
    ]);

    if (ragResult) {
      ragContext = ragResult.compressedContext;
      citations = ragResult.citations;
      logger.info('RAG retrieval completed', {
        chunksRetrieved: ragResult.retrievedChunks.length,
        citationsCount: citations.length
      });
    }

    // 8. Build prompt with all context
    const explicitContext = renderChatContext(buildChatContextBundle(request));
    const systemPrompt = this.buildSystemPrompt(contract, contextSummary, ragContext, request.systemPrompt);
    const userPrompt = this.buildUserPrompt(request.message, memoryContext, ragContext, explicitContext);

    // 9. Generate response
    let response: string;
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

        const llmResponse = await adapter.generate(llmOptions);
        response = llmResponse.content;

        // 10. Safety checks
        if (this.safetyPipeline) {
          const safetyResult = await this.safetyPipeline.check(response, !!ragContext);
          
          if (!safetyResult.safe) {
            logger.warn('Safety check failed', { warnings: safetyResult.warnings });
            
            if (safetyResult.mitigatedContent) {
              response = safetyResult.mitigatedContent;
            } else if (attempts < maxRetries) {
              // Retry with adjusted prompt
              continue;
            } else {
              response = "I apologize, but I cannot provide a response that meets safety standards. Could you rephrase your question?";
            }
          }

          // Add warnings if any
          if (safetyResult.warnings.length > 0) {
            logger.warn('Safety warnings', { warnings: safetyResult.warnings });
          }
        }

        // 11. Validate response
        const validationResult = this.validatorPipeline.validate(response);
        
        if (validationResult.valid) {
          // 12. Create provenance record
          const artifactId = uuidv4();
          this.provenanceLedger.createRecord(
            artifactId,
            ArtifactType.RESPONSE,
            response,
            contract,
            selectedModel,
            { temperature: 0.7, maxTokens: 1000 },
            'system'
          );

          // 13. Store in memory
          this.memoryService.addSessionMemory(request.sessionId, {
            content: `User: ${request.message}\nAssistant: ${response}`,
            turn_number: 0,
            metadata: {
              salience: 1.0
            }
          });

          // 14. Add citations if available
          if (citations.length > 0) {
            // Format citations manually
            const citationText = '\n\nSources:\n' + citations.map((citation, index) => {
              const source = citation.metadata.title || citation.source;
              return `[${index + 1}] ${source}${citation.metadata.date ? ` (${citation.metadata.date})` : ''}`;
            }).join('\n');
            response += citationText;
          }

          // 15. Create response
          const chatResponse: ChatResponse = {
            response,
            artifactId,
            contractVersion: contract.version,
            latency: Date.now() - startTime,
            model: selectedModel,
            warnings: validationResult.warnings
          };

          // 16. Cache response
          if (this.semanticCache) {
            this.semanticCache.set(request.message, chatResponse);
          }

          // Record metrics
          metricsCollector.recordRequest(true, intent.intent);
          metricsCollector.recordLatency(chatResponse.latency);

          // Track analytics if available
          if ((this as any).analytics) {
            (this as any).analytics.trackRequest({
              userId: request.userId,
              sessionId: request.sessionId,
              model: selectedModel,
              intent: intent.intent,
              latency: chatResponse.latency,
              success: true,
              query: request.message,
            });
          }

          logger.info('Request processed successfully', {
            sessionId: request.sessionId,
            latency: chatResponse.latency,
            model: selectedModel
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

  /**
   * Infer task type from message
   */
  private inferTaskType(message: string): TaskType {
    const lower = message.toLowerCase();

    const codingPatterns = [
      'code',
      'function',
      'program',
      'bug',
      'stack trace',
      'typescript',
      'javascript',
      'route',
      'endpoint',
      'diff',
      'patch',
      'test',
      'lint',
      'type-check',
      'refactor',
      'repository',
      'repo'
    ];

    if (codingPatterns.some(pattern => lower.includes(pattern))) {
      return TaskType.CODE_GENERATION;
    }
    if (/\b(derivative|differentiate|integral|limit|solve equation|matrix|proof|theorem|probability|statistics|optimization)\b/.test(lower)) {
      if (/\b(proof|theorem|prove)\b/.test(lower)) return TaskType.MATH_PROOF;
      if (/\b(numeric|approximate|simulation|monte carlo|optimization)\b/.test(lower)) return TaskType.MATH_NUMERIC;
      return TaskType.MATH_SYMBOLIC;
    }
    if (/\b(stock|ticker|shares|options|calls|puts|valuation|10-k|10-q|sec|fred|macro|backtest|portfolio)\b/.test(lower)) {
      if (/\b(backtest|strategy|sharpe|drawdown)\b/.test(lower)) return TaskType.MARKET_BACKTEST;
      if (/\b(risk|options|calls|puts|all in|all my money)\b/.test(lower)) return TaskType.MARKET_RISK;
      return TaskType.MARKET_RESEARCH;
    }
    if (/\b(game|godot|unity|unreal|phaser|pygame|boss|enemy|level|shader|dps|time-to-kill|prototype)\b/.test(lower)) {
      if (/\b(dps|time-to-kill|ttk|hp|damage|cooldown|drop rate|xp curve|balance)\b/.test(lower)) return TaskType.GAME_BALANCE;
      if (/\b(prototype|playable|scene)\b/.test(lower)) return TaskType.GAME_PROTOTYPE;
      if (/\b(code|script|gdscript|c#|typescript|blueprint)\b/.test(lower)) return TaskType.GAME_CODE;
      return TaskType.GAME_DESIGN;
    }
    if (/\b(six sigma|dmaic|cpk|gage r&r|dpmo|sipoc|ctq|cssbb|black belt|control chart|doe|rohs|reach|prop 65|tsca)\b/.test(lower)) {
      if (/\b(calculate|cpk|cp\b|sample size|gage r&r|dpmo|copq|anova|regression)\b/.test(lower)) return TaskType.SIXSIGMA_CALCULATION;
      if (/\b(project|charter|sipoc|ctq|define|measure|analyze|improve|control)\b/.test(lower)) return TaskType.SIXSIGMA_PROJECT_COACHING;
      if (/\b(reach|rohs|prop 65|tsca|sds|supplier|compliance)\b/.test(lower)) return TaskType.SIXSIGMA_COMPLIANCE;
      if (/\b(cssbb|certification|exam|study|belt)\b/.test(lower)) return TaskType.SIXSIGMA_CERTIFICATION;
      if (/\b(control chart|doe|simulation|process map)\b/.test(lower)) return TaskType.SIXSIGMA_SIMULATION;
      if (/\b(export|excel|minitab|python|jupyter|spss|jmp)\b/.test(lower)) return TaskType.SIXSIGMA_EXPORT;
      return TaskType.SIXSIGMA_QA;
    }
    if (/\b(pop culture|film|movie|tv|album|music|hip-hop|franchise|celebrity|awards|comics|video games|meme)\b/.test(lower)) {
      return lower.includes('timeline') ? TaskType.CHRONO_TIMELINE : TaskType.POP_CULTURE_QA;
    }
    if (/\b(prehistory|ancient|medieval|empire|civilization|war|dynasty|archaeology|primary source|history)\b/.test(lower)) {
      return lower.includes('timeline') ? TaskType.CHRONO_TIMELINE : TaskType.HISTORY_QA;
    }
    if (/\b(invention|discovery|patent|scientific paper|openalex|uspto|gbif|wheel|metallurgy|astronomy|medicine|physics|chemistry|biology)\b/.test(lower)) {
      return lower.includes('timeline') ? TaskType.CHRONO_TIMELINE : TaskType.SCIENCE_INVENTION_QA;
    }
    if (lower.includes('analyze') || lower.includes('compare') || lower.includes('evaluate')) {
      return TaskType.ANALYSIS;
    }
    if (lower.includes('write') || lower.includes('story') || lower.includes('creative')) {
      return TaskType.CREATIVE_WRITING;
    }
    if (lower.includes('explain') || lower.includes('why') || lower.includes('how')) {
      return TaskType.COMPLEX_REASONING;
    }
    if (lower.length < 50) {
      return TaskType.SIMPLE_QUERY;
    }

    return TaskType.GENERAL;
  }

  private formatCodingResponse(result: Awaited<ReturnType<CodingAgent['handle']>>): string {
    const sections = [
      `Summary\n${result.summary}`,
      `Intent\n${result.intent}`,
      `Files inspected\n${result.filesInspected.length ? result.filesInspected.map(file => `- ${file}`).join('\n') : '- none'}`,
      `Plan\n${result.plan.steps.map(step => `- ${step}`).join('\n')}`,
      `Patch\n${result.patch.diff || '(no patch generated)'}`,
      `Verification\n${result.verification.status}${result.commandsRun.length ? `: ${result.commandsRun.join(', ')}` : ''}`
    ];

    if (result.review.findings.length > 0) {
      sections.push(`Review findings\n${result.review.findings.map(finding => `- ${finding.severity}: ${finding.issue}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Determine if RAG should be used
   */
  private shouldUseRAG(message: string): boolean {
    const lower = message.toLowerCase();
    const conversationalPatterns = [
      'what can you do',
      'what are you able to do',
      'how can you help',
      'what can you help',
      'your capabilities',
      'what do you do'
    ];

    if (conversationalPatterns.some(pattern => lower.includes(pattern))) {
      return false;
    }

    // Use RAG for questions and information queries
    const questionWords = ['what', 'who', 'when', 'where', 'why', 'how', 'explain', 'tell me about'];
    return questionWords.some(word => lower.startsWith(word) || lower.includes(` ${word} `));
  }

  /**
   * Build system prompt with RAG context
   */
  private buildSystemPrompt(
    contract: AIContract,
    contextSummary: string,
    ragContext?: string,
    systemInstruction?: string
  ): string {
    let prompt = `You are a helpful AI assistant. You can answer questions, engage in conversation, and provide information on a wide variety of topics.

${systemInstruction ? `User-selected system instruction: ${systemInstruction}\n` : ''}

Context from previous conversation: ${contextSummary}`;

    if (ragContext) {
      prompt += `\n\nRelevant information from knowledge base:\n${ragContext}`;
    }

    prompt += `\n\nGuidelines:
- Be helpful, accurate, and concise
- If you don't know something, say so
- Maintain a friendly and professional tone
- Contract version: ${contract.version}`;

    return prompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(
    message: string,
    memoryContext: any,
    ragContext?: string,
    explicitContext?: string
  ): string {
    return explicitContext?.trim()
      ? `Explicit user-provided context:\n${explicitContext}\n\nUser request:\n${message}`
      : message;
  }

  /**
   * Get RAG service (for adding documents)
   */
  getRAGService(): RAGService | undefined {
    return this.ragService;
  }
}

