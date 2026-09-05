import { describe, it, expect } from '@jest/globals';
import { ChatContextPlanner } from '../ChatContextPlanner';
import { NormalizedChatRequest, TaskClassificationResult } from '../../../types/chat-runtime';
import { ChatConversationState, ChatPolicyResolution } from '../ChatRuntime';

describe('Context Planner Test Matrix (CRK-P05-T07 & Phase 05 Exit Gate)', () => {
  const planner = new ChatContextPlanner();

  const dummyPolicy: ChatPolicyResolution = {
    botProfileId: 'default',
    allowedModels: ['gpt-4o'],
    maxContextTokens: 16000,
    toolsEnabled: true,
  };

  const dummyAnalysis: TaskClassificationResult = {
    taskType: 'general_qa',
    intent: 'conversation',
    confidence: 0.9,
    heuristicSignals: [],
    requiresTools: false,
    requiresGrounding: true,
  };

  const dummyState: ChatConversationState = {
    sessionId: 'sess-1',
    messageHistory: [],
    variables: {},
  };

  function createRequest(message: string, extra: Partial<NormalizedChatRequest> = {}): NormalizedChatRequest {
    return {
      requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: 'sess-1',
      message,
      botProfileId: 'default',
      loadedFiles: [],
      loadedAudio: [],
      clientCapabilities: { streaming: false, citations: true, toolApproval: false },
      metadata: {},
      ...extra,
    };
  }

  it('Matrix Case 1: "write a limerick" -> no RAG (§1324)', async () => {
    const req = createRequest('write a limerick about a database');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(false);
    expect(plan.structuredPlan?.rationaleCodes).toContain('NO_RAG_CREATIVE_OR_REWRITE');
    const noneReq = plan.structuredPlan?.requirements.find(r => r.type === 'none');
    expect(noneReq).toBeDefined();
  });

  it('Matrix Case 2: "what does this attached file say?" -> loaded file only (§1325)', async () => {
    const req = createRequest('what does this attached file say?', {
      loadedFiles: [{ path: 'notes.txt', content: 'Important notes here' }],
    });
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(false);
    expect(plan.structuredPlan?.rationaleCodes).toContain('NO_RAG_ATTACHED_SUFFICIENT');
  });

  it('Matrix Case 3: "fix TS2322 in this repo" -> project + typescript docs + developer Q&A (§1326)', async () => {
    const req = createRequest('fix TS2322 in this repo');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: { ...dummyAnalysis, taskType: 'coding', requiresTools: true },
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(true);
    expect(plan.retrievalStrategy.packIds).toContain('core-official-docs');
    expect(plan.retrievalStrategy.packIds).toContain('developer-qa');

    const projectReq = plan.structuredPlan?.requirements.find(r => r.type === 'project');
    expect(projectReq).toBeDefined();
    if (projectReq && projectReq.type === 'project') {
      expect(projectReq.focusSymbols).toContain('TS2322');
      expect(projectReq.includeDiagnostics).toBe(true);
    }
  });

  it('Matrix Case 4: "what is photosynthesis?" -> general knowledge (§1327)', async () => {
    const req = createRequest('what is photosynthesis?');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(true);
    expect(plan.retrievalStrategy.packIds).toContain('general-knowledge');
  });

  it('Matrix Case 5: "what changed in Godot 4.7?" -> version-filtered official docs (§1328)', async () => {
    const req = createRequest('what changed in Godot 4.7?');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(true);
    expect(plan.structuredPlan?.rationaleCodes).toContain('VERSION_FILTERED_DOCS');
    const knowledgeReq = plan.structuredPlan?.requirements.find(r => r.type === 'knowledge');
    expect(knowledgeReq).toBeDefined();
    if (knowledgeReq && knowledgeReq.type === 'knowledge') {
      expect(knowledgeReq.filters.requireFreshness).toBe(true);
    }
  });

  it('Matrix Case 6: "continue the plan" -> active plan + conversation state (§1329)', async () => {
    const req = createRequest('continue the plan', {
      activePlan: { id: 'plan-101', content: 'Step 1 done.' },
    });
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.structuredPlan?.rationaleCodes).toContain('ACTIVE_PLAN_REFERENCED');
    const varsReq = plan.structuredPlan?.requirements.find(r => r.type === 'variables');
    expect(varsReq).toBeDefined();
    if (varsReq && varsReq.type === 'variables') {
      expect(varsReq.keys).toContain('activePlan');
    }
  });

  it('Matrix Case 7: "prove derivative of sin x" -> math pack (§1330)', async () => {
    const req = createRequest('prove derivative of sin x');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(true);
    expect(plan.retrievalStrategy.packIds).toContain('math');
    expect(plan.structuredPlan?.rationaleCodes).toContain('KNOWLEDGE_MATH_PACK');
  });

  it('Matrix Case 8: "explain why my current test fails" -> project/test evidence first (§1331)', async () => {
    const req = createRequest('explain why my current test fails');
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    const projectReq = plan.structuredPlan?.requirements.find(r => r.type === 'project');
    expect(projectReq).toBeDefined();
    if (projectReq && projectReq.type === 'project') {
      expect(projectReq.includeTests).toBe(true);
      expect(projectReq.includeDiagnostics).toBe(true);
    }
  });

  it('Matrix Case 9: "don\'t search online" -> no online retrieval (§1332)', async () => {
    const req = createRequest("explain how memory allocation works, but don't search online");
    const plan = await planner.plan({
      request: req,
      state: dummyState,
      analysis: dummyAnalysis,
      policy: dummyPolicy,
    });

    expect(plan.retrievalStrategy.useRAG).toBe(false);
    expect(plan.structuredPlan?.rationaleCodes).toContain('NO_RAG_USER_RESTRICTED');
  });
});
