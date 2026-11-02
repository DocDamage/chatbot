import { EnhancedOrchestrator } from '../EnhancedOrchestrator';
import { TemplateAdapter } from '../../providers/LLMAdapter';
import { RAGService } from '../../rag/RAGService';
import { SafetyPipeline } from '../../safety/SafetyPipeline';
import { SemanticCache } from '../../cache/SemanticCache';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { FunctionCaller } from '../../tools/FunctionCaller';
import { TaskType } from '../../providers/ModelRouter';

describe('RT-ORCH-001: EnhancedOrchestrator Full Lifecycle & Agent Routing Suite', () => {
  let adapter: TemplateAdapter;

  beforeEach(() => {
    adapter = new TemplateAdapter();
  });

  it('processes normal conversation with RAG, safety pipeline, and semantic cache', async () => {
    const ragService = new RAGService(adapter);
    ragService.addDocuments([{
      id: 'doc-1',
      content: 'Antigravity AI engine architecture and workflows.',
      metadata: { title: 'Architecture' }
    }]);

    const safetyPipeline = new SafetyPipeline(adapter, undefined);
    const semanticCache = new SemanticCache<any>(0.95);

    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: true,
      ragService,
      useSafetyPipeline: true,
      safetyPipeline,
      useSemanticCache: true,
      semanticCache,
      useModelRouting: true,
      useToolCalling: false
    });

    // 1. Process request
    const resp1 = await orchestrator.processRequest({
      message: 'Tell me about the Antigravity architecture',
      sessionId: 'session-orch-1',
      userId: 'user-orch-1'
    });

    expect(resp1.response).toBeDefined();

    // 2. Second identical request hits semantic cache
    const resp2 = await orchestrator.processRequest({
      message: 'Tell me about the Antigravity architecture',
      sessionId: 'session-orch-1',
      userId: 'user-orch-1'
    });

    expect(resp2.response).toBeDefined();
  });

  it('executes tool calling workflow when tool registry and function caller are provided', async () => {
    const toolRegistry = new ToolRegistry();
    toolRegistry.register({
      id: 'calc-tool',
      name: 'calculator',
      description: 'Performs arithmetic calculation',
      category: 'calculation',
      parameters: [{
        name: 'expr',
        type: 'string',
        description: 'Math expression',
        required: true
      }],
      execute: async (args: any) => ({ success: true, data: { result: 42, expression: args.expr } })
    });

    const functionCaller = new FunctionCaller(toolRegistry);

    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: false,
      useSafetyPipeline: false,
      useSemanticCache: false,
      useModelRouting: false,
      useToolCalling: true,
      toolRegistry,
      functionCaller
    });

    const response = await orchestrator.processRequest({
      message: 'calculate 6 * 7 using calculator',
      sessionId: 'session-calc'
    });

    expect(response.response).toBeDefined();
  });

  it('handles image generation requests when image adapter is attached', async () => {
    const mockImageAdapter: any = {
      generateImage: jest.fn().mockResolvedValue({
        base64: 'fake-image-base64',
        mimeType: 'image/png'
      })
    };

    const orchestrator = new EnhancedOrchestrator(adapter, mockImageAdapter, {
      useRAG: false,
      useSafetyPipeline: false,
      useSemanticCache: false,
      useModelRouting: false
    });

    const response = await orchestrator.processRequest({
      message: 'generate image of a cyberpunk city at sunset',
      sessionId: 'session-img'
    });

    expect(response.response).toBeDefined();
  });

  it('handles safety violations and unapproved contract intents', async () => {
    const safetyPipeline = {
      check: jest.fn().mockResolvedValue({
        safe: false,
        warnings: ['Safety violation detected'],
        mitigatedContent: 'Mitigated safe response for user'
      })
    };

    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: false,
      useSafetyPipeline: true,
      safetyPipeline: safetyPipeline as any,
      useSemanticCache: false
    });

    const response = await orchestrator.processRequest({
      message: 'potentially sensitive prompt',
      sessionId: 'session-sensitive'
    });

    expect(response.response).toBe('Mitigated safe response for user');
  });

  it('infers task types across all specialist domains accurately', () => {
    const orchestrator = new EnhancedOrchestrator(adapter);

    expect((orchestrator as any).inferTaskType('prove the Pythagorean theorem')).toBe(TaskType.MATH_PROOF);
    expect((orchestrator as any).inferTaskType('probability monte carlo simulation numeric')).toBe(TaskType.MATH_NUMERIC);
    expect((orchestrator as any).inferTaskType('solve equation derivative')).toBe(TaskType.MATH_SYMBOLIC);

    expect((orchestrator as any).inferTaskType('portfolio strategy sharpe drawdown')).toBe(TaskType.MARKET_BACKTEST);
    expect((orchestrator as any).inferTaskType('shares risk options calls puts')).toBe(TaskType.MARKET_RISK);
    expect((orchestrator as any).inferTaskType('valuation 10-k sec filing for ticker')).toBe(TaskType.MARKET_RESEARCH);

    expect((orchestrator as any).inferTaskType('godot boss ttk and dps balance')).toBe(TaskType.GAME_BALANCE);
    expect((orchestrator as any).inferTaskType('unity playable prototype scene')).toBe(TaskType.GAME_PROTOTYPE);
    expect((orchestrator as any).inferTaskType('unreal blueprint gdscript')).toBe(TaskType.GAME_CODE);
    expect((orchestrator as any).inferTaskType('unreal level enemy boss mechanics')).toBe(TaskType.GAME_DESIGN);

    expect((orchestrator as any).inferTaskType('calculate cpk and anova for six sigma')).toBe(TaskType.SIXSIGMA_CALCULATION);
    expect((orchestrator as any).inferTaskType('six sigma dmaic project charter sipoc')).toBe(TaskType.SIXSIGMA_PROJECT_COACHING);
    expect((orchestrator as any).inferTaskType('rohs reach prop 65 compliance supplier')).toBe(TaskType.SIXSIGMA_COMPLIANCE);
    expect((orchestrator as any).inferTaskType('cssbb black belt certification exam study')).toBe(TaskType.SIXSIGMA_CERTIFICATION);
    expect((orchestrator as any).inferTaskType('six sigma simulation doe process map')).toBe(TaskType.SIXSIGMA_SIMULATION);
    expect((orchestrator as any).inferTaskType('export minitab excel six sigma jmp')).toBe(TaskType.SIXSIGMA_EXPORT);
    expect((orchestrator as any).inferTaskType('six sigma quality standard question')).toBe(TaskType.SIXSIGMA_QA);

    expect((orchestrator as any).inferTaskType('pop culture movie franchise timeline')).toBe(TaskType.CHRONO_TIMELINE);
    expect((orchestrator as any).inferTaskType('pop culture hip-hop album awards')).toBe(TaskType.POP_CULTURE_QA);
    expect((orchestrator as any).inferTaskType('ancient roman empire dynasty history')).toBe(TaskType.HISTORY_QA);
    expect((orchestrator as any).inferTaskType('scientific discovery uspto patent invention')).toBe(TaskType.SCIENCE_INVENTION_QA);

    expect((orchestrator as any).inferTaskType('compare and evaluate these two approaches')).toBe(TaskType.ANALYSIS);
    expect((orchestrator as any).inferTaskType('write a creative story about space')).toBe(TaskType.CREATIVE_WRITING);
    expect((orchestrator as any).inferTaskType('explain how quantum computing works why')).toBe(TaskType.COMPLEX_REASONING);
    expect((orchestrator as any).inferTaskType('short hi')).toBe(TaskType.SIMPLE_QUERY);
    expect((orchestrator as any).inferTaskType('A'.repeat(60))).toBe(TaskType.GENERAL);
  });

  it('formats coding responses with findings, risks, and structured patches', () => {
    const orchestrator = new EnhancedOrchestrator(adapter);

    const formatted = (orchestrator as any).formatCodingResponse({
      summary: 'Added tests',
      intent: 'code_refactor',
      filesInspected: ['src/index.ts', 'src/app.ts'],
      plan: { steps: ['Step 1', 'Step 2'], requiredEvidence: [], intent: 'code_refactor' },
      patch: { diff: '+ code', format: 'unified-diff', filesChanged: ['src/index.ts'], explanation: 'added' },
      structuredPatch: { filesChanged: [{ path: 'src/index.ts' }] },
      commandsRun: ['npm test'],
      verification: { status: 'passed', commandsRun: ['npm test'], results: [], remainingRisks: [] },
      review: { findings: [{ severity: 'low', issue: 'minor styling' }], summary: 'good' },
      risks: ['potential edge case']
    });

    expect(formatted).toContain('Added tests');
    expect(formatted).toContain('src/index.ts');
    expect(formatted).toContain('minor styling');
    expect(formatted).toContain('potential edge case');
    expect(formatted).toContain('structured file(s) proposed');
  });
});
