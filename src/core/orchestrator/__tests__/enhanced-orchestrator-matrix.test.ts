import { EnhancedOrchestrator } from '../EnhancedOrchestrator';
import { TemplateAdapter } from '../../providers/LLMAdapter';
import { CodingAgent } from '../../agents/CodingAgent';

describe('B75-08: EnhancedOrchestrator Decision Branches Matrix', () => {
  let adapter: TemplateAdapter;

  beforeEach(() => {
    adapter = new TemplateAdapter();
  });

  it('handles coding intent through coding agent pipeline', async () => {
    const codingAgent = new CodingAgent({ workspaceRoot: process.cwd() });
    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useToolCalling: true,
      codingAgent,
      useRAG: false
    });

    const res = await orchestrator.processRequest({
      message: 'Write a typescript function to parse JSON safely',
      sessionId: 'sess-code-1'
    });

    expect(res.response).toBeDefined();
    expect(res.model).toContain('coding-agent');
  });

  it('handles image generation intent with and without image adapter', async () => {
    const mockImageAdapter = {
      generateImage: jest.fn().mockResolvedValue({
        imageData: 'data:image/png;base64,mockpngdata',
        mimeType: 'image/png'
      })
    };

    const orchestratorWithImage = new EnhancedOrchestrator(adapter, mockImageAdapter as any, {
      useRAG: false
    });

    const imageRes = await orchestratorWithImage.processRequest({
      message: 'Generate an image of a neon cyberpunk city at sunset',
      sessionId: 'sess-img-1'
    });

    expect(imageRes.response).toBeDefined();

    // Without image adapter -> returns fallback text
    const orchestratorWithoutImage = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: false
    });

    const fallbackRes = await orchestratorWithoutImage.processRequest({
      message: 'Generate a photo of mountains',
      sessionId: 'sess-img-2'
    });
    expect(fallbackRes.response).toBeDefined();
  });

  it('allows a confirmed local-knowledge miss to bypass broad RAG retrieval', async () => {
    const ragService = {
      processQuery: jest.fn().mockResolvedValue(null),
      getRetriever: jest.fn().mockReturnValue(undefined)
    };
    const orchestrator = new EnhancedOrchestrator(adapter, undefined, {
      useRAG: true,
      ragService: ragService as any,
      useSafetyPipeline: false,
      useSemanticCache: false,
      useModelRouting: false
    });

    const result = await orchestrator.processRequest({
      message: 'what can you tell me about hip hop in 1997?',
      sessionId: 'confirmed-knowledge-miss',
      useRAG: false
    });

    expect(result.response).toBeDefined();
    expect(ragService.processQuery).not.toHaveBeenCalled();
  });
});
