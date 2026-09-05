import {
  normalizedChatRequestSchema,
  chatRuntimeResultSchema,
  citationRefSchema,
  toolResultSummarySchema,
  chatContextPlanSchema,
  taskClassificationResultSchema,
  chatTraceContextSchema,
  NormalizedChatRequest,
  ChatRuntimeResult,
  ChatContextPlan,
} from './chat-runtime';

describe('Canonical ChatRuntime Schemas (CRK-P01-T01)', () => {
  describe('normalizedChatRequestSchema', () => {
    it('parses a minimal valid chat request and applies canonical defaults', () => {
      const raw = {
        requestId: 'req_123456789',
        sessionId: 'sess_987654321',
        message: 'Explain how the canonical chat runtime works.',
      };

      const parsed: NormalizedChatRequest = normalizedChatRequestSchema.parse(raw);

      expect(parsed.requestId).toBe('req_123456789');
      expect(parsed.sessionId).toBe('sess_987654321');
      expect(parsed.message).toBe('Explain how the canonical chat runtime works.');
      expect(parsed.botProfileId).toBe('default');
      expect(parsed.loadedFiles).toEqual([]);
      expect(parsed.loadedAudio).toEqual([]);
      expect(parsed.clientCapabilities).toEqual({
        streaming: false,
        citations: false,
        toolApproval: false,
      });
      expect(parsed.metadata).toEqual({});
    });

    it('parses a fully populated request with files, audio, plan, and client capabilities', () => {
      const raw = {
        requestId: 'req_full_1',
        sessionId: 'sess_full_1',
        userId: 'user_42',
        message: 'Refactor this module according to the plan.',
        mode: 'coding',
        botProfileId: 'expert_coder',
        explicitSystemInstruction: 'Prioritize minimal diffs and verified tests.',
        loadedFiles: [
          {
            path: 'src/core/chat/ChatRuntime.ts',
            content: 'export class ChatRuntime {}',
            language: 'typescript',
            size: 28,
          },
        ],
        loadedAudio: [
          {
            path: 'audio/voice_memo.wav',
            format: 'wav',
            duration: 12.5,
            sampleRate: 44100,
            channels: 2,
          },
        ],
        activePlan: {
          id: 'plan_crk_01',
          content: 'Step 1: define schemas. Step 2: build normalizer.',
        },
        clientCapabilities: {
          streaming: true,
          citations: true,
          toolApproval: true,
        },
        requestedModelPolicy: 'HIGH_PERFORMANCE',
        metadata: {
          source: 'web_client',
          viewport: 'desktop',
        },
      };

      const parsed = normalizedChatRequestSchema.parse(raw);
      expect(parsed.userId).toBe('user_42');
      expect(parsed.mode).toBe('coding');
      expect(parsed.loadedFiles).toHaveLength(1);
      expect(parsed.loadedFiles[0].path).toBe('src/core/chat/ChatRuntime.ts');
      expect(parsed.loadedAudio).toHaveLength(1);
      expect(parsed.loadedAudio[0].duration).toBe(12.5);
      expect(parsed.activePlan?.id).toBe('plan_crk_01');
      expect(parsed.clientCapabilities.streaming).toBe(true);
      expect(parsed.requestedModelPolicy).toBe('HIGH_PERFORMANCE');
      expect(parsed.metadata.source).toBe('web_client');
    });

    it('rejects invalid inputs such as empty message or blank request ID', () => {
      expect(() => normalizedChatRequestSchema.parse({
        requestId: '',
        sessionId: 'sess_1',
        message: 'hello',
      })).toThrow();

      expect(() => normalizedChatRequestSchema.parse({
        requestId: 'req_1',
        sessionId: '',
        message: 'hello',
      })).toThrow();

      expect(() => normalizedChatRequestSchema.parse({
        requestId: 'req_1',
        sessionId: 'sess_1',
        message: '   ',
      })).toThrow();
    });
  });

  describe('chatRuntimeResultSchema', () => {
    it('validates a complete ChatRuntimeResult with citations, tools, and grounding', () => {
      const resultData = {
        requestId: 'req_abc123',
        response: 'Here is the verified explanation with source citations.',
        model: {
          provider: 'anthropic',
          model: 'claude-3-5-sonnet',
          policy: 'BALANCED',
          fallbackUsed: false,
        },
        citations: [
          {
            id: 'cit_1',
            sourceId: 'src_doc_1',
            datasetId: 'ds_official_docs',
            title: 'Runtime Architecture Specification',
            sourceUrl: 'https://docs.example.com/runtime',
            chunkId: 'chunk_99',
            quoteStart: 10,
            quoteEnd: 85,
            authority: 0.95,
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_lookup_1',
            toolName: 'knowledge_search',
            status: 'success' as const,
            summary: 'Retrieved 3 documentation chunks',
            durationMs: 42,
          },
        ],
        warnings: [],
        latencyMs: 345,
        traceId: 'trace_xyz789',
        grounding: {
          attempted: true,
          sufficient: true,
          confidence: 0.94,
        },
      };

      const parsed: ChatRuntimeResult = chatRuntimeResultSchema.parse(resultData);
      expect(parsed.requestId).toBe('req_abc123');
      expect(parsed.response).toContain('verified explanation');
      expect(parsed.model.fallbackUsed).toBe(false);
      expect(parsed.citations).toHaveLength(1);
      expect(parsed.citations[0].title).toBe('Runtime Architecture Specification');
      expect(parsed.toolResults).toHaveLength(1);
      expect(parsed.grounding.sufficient).toBe(true);
      expect(parsed.latencyMs).toBe(345);
    });

    it('enforces privacy: does not declare internal chain-of-thought or reasoning fields', () => {
      const resultData = {
        requestId: 'req_abc123',
        response: 'Clean public response.',
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          policy: 'ACCURACY',
          fallbackUsed: false,
        },
        citations: [],
        toolResults: [],
        warnings: [],
        latencyMs: 120,
        traceId: 'trace_priv_1',
        grounding: {
          attempted: false,
          sufficient: false,
        },
        // Private fields that must NOT be exposed in typed result
        internalReasoning: 'Hidden thoughts should not leak',
        chainOfThought: 'Step 1: hidden thought',
      };

      const parsed = chatRuntimeResultSchema.parse(resultData) as Record<string, unknown>;
      // By default Zod strips undeclared keys, preserving public contract purity
      expect(parsed.internalReasoning).toBeUndefined();
      expect(parsed.chainOfThought).toBeUndefined();
    });

    it('rejects invalid latency and unapproved tool statuses', () => {
      const invalidData = {
        requestId: 'req_1',
        response: 'Test',
        model: {
          provider: 'local',
          model: 'llama3',
          policy: 'FAST',
          fallbackUsed: false,
        },
        latencyMs: -10, // negative latency invalid
        traceId: 'trace_1',
        grounding: { attempted: false, sufficient: false },
      };

      expect(() => chatRuntimeResultSchema.parse(invalidData)).toThrow();
    });
  });

  describe('citationRefSchema and toolResultSummarySchema', () => {
    it('validates citation references with authority bounds', () => {
      const valid = citationRefSchema.parse({
        id: 'c1',
        sourceId: 's1',
        title: 'Title',
        chunkId: 'chk1',
        authority: 0.88,
      });
      expect(valid.id).toBe('c1');

      expect(() => citationRefSchema.parse({
        id: 'c1',
        sourceId: 's1',
        title: 'Title',
        chunkId: 'chk1',
        authority: 1.5, // > 1.0 out of range
      })).toThrow();
    });

    it('supports required approval status for tools', () => {
      const toolApproval = toolResultSummarySchema.parse({
        toolCallId: 'call_fs_rm',
        toolName: 'file_delete',
        status: 'requires_approval',
        summary: 'Requires user confirmation before proceeding.',
      });
      expect(toolApproval.status).toBe('requires_approval');
    });
  });

  describe('chatContextPlanSchema and taskClassificationResultSchema', () => {
    it('validates a complete context plan with classified task and strategies', () => {
      const taskClassification = taskClassificationResultSchema.parse({
        taskType: 'coding',
        intent: 'code_generation',
        confidence: 0.92,
        specialistDomain: 'typescript_backend',
        heuristicSignals: ['code_fence_detected', 'import_keyword'],
        requiresTools: true,
        requiresGrounding: true,
      });

      const plan: ChatContextPlan = chatContextPlanSchema.parse({
        requestId: 'req_plan_1',
        traceId: 'trace_plan_1',
        taskClassification,
        retrievalStrategy: {
          useRAG: true,
          packIds: ['pack_ts_docs', 'pack_repo_code'],
          maxSources: 5,
          minRelevanceScore: 0.75,
        },
        memoryStrategy: {
          includeHistory: true,
          maxMessages: 10,
          includeVariables: true,
        },
        toolStrategy: {
          enabledTools: ['run_linter', 'read_file'],
          requireApproval: false,
        },
        modelStrategy: {
          policy: 'BALANCED',
          preferredModel: 'claude-3-5-sonnet',
          fallbackModel: 'gpt-4o',
          temperature: 0.2,
          maxTokens: 4096,
        },
        budgetLimits: {
          maxContextTokens: 32000,
          maxOutputTokens: 4096,
        },
      });

      expect(plan.requestId).toBe('req_plan_1');
      expect(plan.retrievalStrategy.useRAG).toBe(true);
      expect(plan.modelStrategy.preferredModel).toBe('claude-3-5-sonnet');
      expect(plan.taskClassification.confidence).toBe(0.92);
    });
  });

  describe('chatTraceContextSchema', () => {
    it('tracks diagnostic stage timings and metadata', () => {
      const trace = chatTraceContextSchema.parse({
        traceId: 'trace_1001',
        requestId: 'req_1001',
        sessionId: 'sess_1001',
        userId: 'user_dev',
        stageTimings: {
          normalize: 2,
          stateLoad: 4,
          classification: 8,
          contextPlanning: 5,
          retrieval: 45,
          modelExecution: 280,
          validation: 3,
        },
        createdAt: new Date().toISOString(),
      });

      expect(trace.traceId).toBe('trace_1001');
      expect(trace.stageTimings.retrieval).toBe(45);
      expect(trace.stageTimings.modelExecution).toBe(280);
    });
  });
});
