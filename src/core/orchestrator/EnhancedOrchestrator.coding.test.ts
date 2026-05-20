import { EnhancedOrchestrator } from './EnhancedOrchestrator';
import { TemplateAdapter } from '../providers/LLMAdapter';

describe('EnhancedOrchestrator coding delegation', () => {
  it('delegates coding requests to the CodingAgent before normal chat generation', async () => {
    const adapter = new TemplateAdapter();
    const generateSpy = jest.spyOn(adapter, 'generate');
    const codingAgent = {
      handle: jest.fn().mockResolvedValue({
        intent: 'code_question',
        summary: 'coding answer',
        filesInspected: ['src/example.ts'],
        plan: { steps: ['inspect'], requiredEvidence: [], intent: 'code_question' },
        patch: { diff: '', format: 'unified-diff', filesChanged: [], explanation: '' },
        commandsRun: [],
        verification: { status: 'not_run', commandsRun: [], results: [], remainingRisks: [] },
        review: { findings: [], summary: 'ok' },
        risks: []
      })
    };
    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: false,
      useModelRouting: false,
      useSafetyPipeline: false,
      useSemanticCache: false,
      codingAgent: codingAgent as any,
      useToolCalling: true
    });

    const response = await orchestrator.processRequest({
      message: 'fix this TypeScript route bug',
      sessionId: 's1'
    });

    expect(codingAgent.handle).toHaveBeenCalled();
    expect(generateSpy).not.toHaveBeenCalled();
    expect(response.model).toBe('coding-agent');
    expect(response.response).toContain('coding answer');
  });
});
