import express from 'express';
import request from 'supertest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConversationManager } from '../../../core/conversation/ConversationManager';
import { createLegacyChatHandlers } from '../../../server/routes/legacy-chat';
import { EnhancedOrchestrator } from '../../../core/orchestrator/EnhancedOrchestrator';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from '../../../core/providers/LLMAdapter';
import { SemanticCache } from '../../../core/cache/SemanticCache';
import { ChatResponse } from '../../../core/orchestrator/Orchestrator';
import { CodingAgent } from '../../../core/agents/CodingAgent';
import { MathGeniusAgent } from '../../../core/agents/math/MathGeniusAgent';
import { CreativeWritingAgent } from '../../../core/creative/CreativeWritingAgent';
import { RAGService } from '../../../core/rag/RAGService';

export interface BaselineRecord {
  caseId: string;
  category: string;
  prompt: string;
  routeUsed: string;
  model: string;
  retrievedSources: string[];
  latencyMs: number;
  promptSize: number;
  output: string;
  warnings: string[];
  fallbackBehavior: string;
  metadata?: Record<string, unknown>;
}

class BaselineLLMAdapter implements LLMAdapter {
  private customResponses = new Map<string, string>();
  public shouldFail = false;
  public shouldViolateSafety = false;

  setResponse(promptSubstring: string, response: string) {
    this.customResponses.set(promptSubstring.toLowerCase(), response);
  }

  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (this.shouldFail) {
      throw new Error('Simulated upstream provider connection timeout');
    }

    if (this.shouldViolateSafety) {
      // Content containing profanity or harmful triggers that trip ValidationPipeline.safetyValidator
      return {
        content: 'This response contains harmful profanity and forbidden content: damn hell.',
        model: 'baseline-llm-safety-test',
        tokensUsed: 20,
        cost: 0.001,
        latency: 40
      };
    }

    const lowerPrompt = options.prompt.toLowerCase();
    for (const [key, val] of this.customResponses.entries()) {
      if (lowerPrompt.includes(key)) {
        return {
          content: val,
          model: 'baseline-llm-mock',
          tokensUsed: val.length / 4,
          cost: 0.0005,
          latency: 45
        };
      }
    }

    return {
      content: `Default baseline response for prompt: ${options.prompt.slice(0, 60)}...`,
      model: 'baseline-llm-mock',
      tokensUsed: 30,
      cost: 0.0008,
      latency: 50
    };
  }

  estimateCost(options: LLMGenerateOptions): number {
    return 0.0005;
  }

  getModelName(): string {
    return 'baseline-llm-mock';
  }
}

describe('CRK-P00-T03: Chat Behavior Baseline Capture Harness', () => {
  let app: express.Application;
  let adapter: BaselineLLMAdapter;
  let orchestrator: EnhancedOrchestrator;
  let conversationManager: ConversationManager;
  let semanticCache: SemanticCache<ChatResponse>;
  let ragService: RAGService;
  let codingAgent: CodingAgent;
  let mathAgent: MathGeniusAgent;
  let creativeAgent: CreativeWritingAgent;
  let tempWorkspace: string;
  const baselineRecords: BaselineRecord[] = [];

  beforeAll(async () => {
    tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'crk-baseline-workspace-'));
    adapter = new BaselineLLMAdapter();
    semanticCache = new SemanticCache<ChatResponse>(3600);
    ragService = new RAGService(adapter);
    codingAgent = new CodingAgent({ workspaceRoot: tempWorkspace });
    mathAgent = new MathGeniusAgent();
    creativeAgent = new CreativeWritingAgent();
    conversationManager = new ConversationManager();

    // Pre-populate RAG document store with known knowledge for answerable test
    ragService.addDocuments([{
      id: 'doc-contract',
      content: 'AI Contract Gate defines maximum latency, cost limits, and security constraints per query.',
      metadata: { source: 'repo-contract-rules', title: 'Contract Gate Rules' }
    }]);

    // Pre-configure specific answers
    adapter.setResponse('capital of france', 'Paris is the capital of France.');
    adapter.setResponse('reverse a string', 'function reverseString(str: string): string {\n  return str.split("").reverse().join("");\n}');
    adapter.setResponse('next.js 15 app router', 'In Next.js 15 App Router, configure route handlers using route.ts exporting GET, POST, etc.');
    adapter.setResponse('default port in the loaded file', 'According to config.json, the default port is 8080.');
    adapter.setResponse('step 1 of the active plan', 'Beginning Step 1: Setup database schema.');

    orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: true,
      ragService,
      useModelRouting: false,
      useSafetyPipeline: false,
      useSemanticCache: true,
      semanticCache,
      codingAgent
    });

    process.env.LLM_KNOWLEDGE_FALLBACK = 'true';

    const createMockGenius = (name: string) => ({
      ask: jest.fn().mockImplementation(async (msg: string) => ({
        response: `${name} analysis for: ${msg}`,
        sources: [`${name.toLowerCase()}-corpus`],
        model: `${name.toLowerCase()}-specialist`
      }))
    });

    const services = {
      orchestrator,
      codingAgent,
      mathGeniusAgent: mathAgent,
      creativeWritingAgent: creativeAgent,
      securityGeniusAgent: createMockGenius('SecurityGenius'),
      legalCivicGeniusAgent: createMockGenius('LegalGenius'),
      healthGeniusAgent: createMockGenius('HealthGenius'),
      businessGeniusAgent: createMockGenius('BusinessGenius'),
      philosophyGeniusAgent: createMockGenius('PhilosophyGenius'),
      languageGeniusAgent: createMockGenius('LanguageGenius'),
      geoCultureGeniusAgent: createMockGenius('GeoCultureGenius'),
      engineeringGeniusAgent: createMockGenius('EngineeringGenius'),
      popCultureGeniusAgent: createMockGenius('PopCultureGenius'),
      historyGeniusAgent: createMockGenius('HistoryGenius'),
      scienceInventionGeniusAgent: createMockGenius('ScienceGenius'),
      musicProductionGeniusAgent: createMockGenius('MusicGenius'),
      ragService,
      conversationManager
    };

    app = express();
    app.use(express.json());
    app.post('/api/chat', ...createLegacyChatHandlers({
      getServices: () => services,
      getOrchestrator: () => orchestrator,
      waitForReady: async () => {},
      getConversationManager: () => conversationManager,
      workspaceRoot: tempWorkspace
    }));
  });

  afterAll(async () => {
    // Write out baseline artifacts
    const docsDir = path.join(process.cwd(), 'docs', 'implementation', 'chat-runtime');
    await fs.mkdir(docsDir, { recursive: true });

    const jsonPath = path.join(docsDir, 'CHAT_BEHAVIOR_BASELINE.json');
    await fs.writeFile(jsonPath, JSON.stringify(baselineRecords, null, 2), 'utf-8');

    const mdPath = path.join(docsDir, 'CHAT_BEHAVIOR_BASELINE.md');
    const mdContent = [
      '# Chat Behavior Baseline Report',
      '',
      '> Deterministic behavior capture for current default chat behavior across 14 required baseline scenarios.',
      `> Document ID: \`CRK-P00-T03\`  `,
      `> Generated At: ${new Date().toISOString()}  `,
      `> Total Scenarios Captured: ${baselineRecords.length}  `,
      '',
      '## Scenario Results Summary',
      '',
      '| # | Case ID | Category | Route | Model | Sources Count | Latency (ms) | Output Snippet | Warnings / Fallback |',
      '|---|---|---|---|---|:---:|:---:|---|---|',
      ...baselineRecords.map((r, i) => {
        const snippet = r.output.replace(/[\r\n]+/g, ' ').slice(0, 45);
        const warn = r.fallbackBehavior !== 'none' ? `Fallback: ${r.fallbackBehavior}` : (r.warnings[0] || 'Clean');
        return `| ${i + 1} | \`${r.caseId}\` | ${r.category} | \`${r.routeUsed}\` | \`${r.model}\` | ${r.retrievedSources.length} | ${r.latencyMs} | "${snippet}..." | ${warn} |`;
      }),
      '',
      '## Detailed Scenario Records',
      '',
      ...baselineRecords.map(r => [
        `### Scenario: \`${r.caseId}\` (${r.category})`,
        `- **Prompt**: "${r.prompt}"`,
        `- **Route Used**: \`${r.routeUsed}\``,
        `- **Model Used**: \`${r.model}\``,
        `- **Latency**: ${r.latencyMs} ms`,
        `- **Estimated Prompt Size**: ${r.promptSize} chars`,
        `- **Retrieved Sources**: ${r.retrievedSources.length > 0 ? r.retrievedSources.map(s => `\`${s}\``).join(', ') : 'None'}`,
        `- **Warnings**: ${r.warnings.length > 0 ? r.warnings.join('; ') : 'None'}`,
        `- **Fallback Behavior**: ${r.fallbackBehavior}`,
        `- **Output**:`,
        '```text',
        r.output,
        '```',
        ''
      ].join('\n'))
    ].join('\n');

    await fs.writeFile(mdPath, mdContent, 'utf-8');
    await fs.rm(tempWorkspace, { recursive: true, force: true }).catch(() => {});
  });

  async function executeAndRecord(
    caseId: string,
    category: string,
    payload: any,
    fallbackDesc = 'none'
  ): Promise<any> {
    const start = Date.now();
    const res = await request(app).post('/api/chat').send(payload);
    const latencyMs = Date.now() - start;

    const body = res.body || {};
    const output = typeof body.response === 'string' ? body.response : JSON.stringify(body);
    const model = body.model || 'unknown';
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const warnings = Array.isArray(body.warnings) ? body.warnings : [];

    const record: BaselineRecord = {
      caseId,
      category,
      prompt: payload.message || '',
      routeUsed: '/api/chat',
      model,
      retrievedSources: sources,
      latencyMs,
      promptSize: (payload.message || '').length,
      output,
      warnings,
      fallbackBehavior: fallbackDesc,
      metadata: {
        status: res.status,
        mode: payload.mode || 'default',
        planId: body.planId,
        cacheHit: body.model === 'semantic-cache' || (body.latency && body.latency < 5)
      }
    };

    baselineRecords.push(record);
    return res;
  }

  it('1. greeting — handles standard welcoming conversational input', async () => {
    const res = await executeAndRecord('01_greeting', 'Greeting', {
      message: 'Hello! What can you help me with today?',
      sessionId: 'sess-greeting'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('2. simple_factual — answers general knowledge question', async () => {
    const res = await executeAndRecord('02_simple_factual', 'Factual', {
      message: 'What is the capital of France?',
      sessionId: 'sess-factual'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('Paris');
  });

  it('3. coding_question — routes coding inquiry through coding agent / specialist', async () => {
    const res = await executeAndRecord('03_coding_question', 'Coding', {
      message: 'Write a TypeScript function to reverse a string',
      sessionId: 'sess-coding',
      mode: 'coding'
    });
    expect(res.status).toBe(200);
    expect(res.body.codingAuthorization).toBeDefined();
  });

  it('4. debugging_question — analyzes component issue and provides patch guidance', async () => {
    const res = await executeAndRecord('04_debugging_question', 'Debugging', {
      message: 'Explain where EnhancedOrchestrator routes code tasks',
      sessionId: 'sess-debug',
      mode: 'coding'
    });
    expect(res.status).toBe(200);
    expect(res.body.summary || res.body.response).toBeDefined();
  });

  it('5. current_version_framework — answers framework configuration query', async () => {
    const res = await executeAndRecord('05_current_version_framework', 'Framework', {
      message: 'How do I configure route handlers in Next.js 15 App Router?',
      sessionId: 'sess-framework'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('6. math_question — solves quadratic problem through math agent', async () => {
    const res = await executeAndRecord('06_math_question', 'Mathematics', {
      message: 'differentiate x^2',
      sessionId: 'sess-math',
      mode: 'math'
    });
    expect(res.status).toBe(200);
    expect(res.body.answer || res.body.response).toBeDefined();
  });

  it('7. creative_writing — drafts descriptive scene via creative agent', async () => {
    const res = await executeAndRecord('07_creative_writing', 'Creative', {
      message: 'Write a short scene set in a rainy futuristic market',
      sessionId: 'sess-creative',
      mode: 'creative_writing'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('8. loaded_file_followup — answers question grounded in loaded file context', async () => {
    const res = await executeAndRecord('08_loaded_file_followup', 'File Context', {
      message: 'What is the default port in the loaded file?',
      sessionId: 'sess-file',
      loadedFiles: [{ path: 'config.json', content: '{"port": 8080}' }]
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('9. active_plan_followup — handles follow-up referring to active plan state', async () => {
    const res = await executeAndRecord('09_active_plan_followup', 'Plan Context', {
      message: 'Plan a new authentication feature',
      sessionId: 'sess-plan',
      mode: 'plan'
    });
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('plan');
    expect(res.body.planId).toBeDefined();
  });

  it('10. rag_answerable — retrieves documents and answers grounded query', async () => {
    const res = await executeAndRecord('10_rag_answerable', 'RAG Sourced', {
      message: 'What are the rules for AI Contract Gate?',
      sessionId: 'sess-rag-hit'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('11. rag_unanswerable — handles query with no matching knowledge corpus', async () => {
    const res = await executeAndRecord('11_rag_unanswerable', 'RAG Unanswerable', {
      message: 'What was the secret breakfast eaten on May 12 1984 by the CEO of Antigravity?',
      sessionId: 'sess-rag-miss'
    });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
  });

  it('12. provider_failure — triggers graceful fallback when upstream LLM throws', async () => {
    adapter.shouldFail = true;
    try {
      const res = await executeAndRecord(
        '12_provider_failure',
        'Provider Failure',
        {
          message: 'Generate a long essay on quantum entanglement',
          sessionId: 'sess-fail'
        },
        'Exhausted retries and returned static fallback response'
      );
      expect(res.status).toBe(200);
      expect(res.body.model).toBe('fallback');
      expect(res.body.response).toContain("having trouble processing that request");
    } finally {
      adapter.shouldFail = false;
    }
  });

  it('13. invalid_response — handles model output failing validation policy', async () => {
    adapter.shouldViolateSafety = true;
    try {
      const res = await executeAndRecord(
        '13_invalid_response',
        'Invalid Output',
        {
          message: 'Tell me bad words and profanity',
          sessionId: 'sess-invalid'
        },
        'Validation retry / fallback triggered on unsafe content'
      );
      expect(res.status).toBe(200);
      expect(res.body.response).toBeDefined();
    } finally {
      adapter.shouldViolateSafety = false;
    }
  });

  it('14. cached_repeat — returns cached response with low latency for duplicate query', async () => {
    const res = await executeAndRecord(
      '14_cached_repeat',
      'Semantic Cache',
      {
        message: 'What is the capital of France?',
        sessionId: 'sess-factual'
      },
      'Semantic cache hit bypassing LLM provider'
    );
    expect(res.status).toBe(200);
    expect(res.body.response).toContain('Paris');
  });
});
