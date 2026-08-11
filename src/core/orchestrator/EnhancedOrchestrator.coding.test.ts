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

  it('routes a configured coding provider into structured patch generation', async () => {
    const adapter = new TemplateAdapter();
    const codingAgent = {
      handle: jest.fn().mockResolvedValue({
        intent: 'write_feature', summary: 'provider-backed coding answer', filesInspected: [],
        plan: { steps: [], requiredEvidence: [], intent: 'write_feature' },
        patch: { diff: '', format: 'unified-diff', filesChanged: [], explanation: '' },
        commandsRun: [], verification: { status: 'not_run', commandsRun: [], results: [], remainingRisks: [] },
        review: { findings: [], summary: 'ok' }, risks: []
      })
    };
    const response = await new EnhancedOrchestrator(adapter, undefined, {
      useRAG: false, useSafetyPipeline: false, useSemanticCache: false,
      useModelRouting: true, codingAgent: codingAgent as any, useToolCalling: true
    }).processRequest({ message: 'implement this code change', sessionId: 's1' });

    expect(codingAgent.handle).toHaveBeenCalledWith(expect.objectContaining({ generatePatch: true, modelAdapter: adapter }));
    expect(response.model).toBe('coding-agent:template/template');
  });
});
