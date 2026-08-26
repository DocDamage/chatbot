import { ModelRouter, TaskType, ModelProvider } from '../ModelRouter';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from '../LLMAdapter';

class TestAdapter implements LLMAdapter {
  constructor(private name: string) {}
  async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
    return { content: `Response from ${this.name}`, model: this.name, tokensUsed: 10, cost: 0.001, latency: 50 };
  }
  estimateCost(): number { return 0.001; }
  getModelName(): string { return this.name; }
}

describe('ModelRouter', () => {
  let router: ModelRouter;

  beforeEach(() => {
    router = new ModelRouter();
  });

  it('falls back to template when no adapters are registered', () => {
    const selection = router.selectModel(TaskType.CODE_GENERATION, { prompt: 'write a sort function' });
    expect(selection.provider).toBe(ModelProvider.TEMPLATE);
    expect(selection.model).toBe('template');
  });

  it('selects registered adapter matching task type with quality and cost sorting', () => {
    const openaiAdapter = new TestAdapter('gpt-4');
    const templateAdapter = new TestAdapter('template');

    router.registerAdapter(ModelProvider.OPENAI, openaiAdapter);
    router.registerAdapter(ModelProvider.TEMPLATE, templateAdapter);

    const selection = router.selectModel(TaskType.CODE_GENERATION, { prompt: 'write a server' });
    expect(selection.provider).toBe(ModelProvider.OPENAI);
    expect(selection.confidence).toBeGreaterThan(0.5);
  });

  it('respects cost limit when selecting models', () => {
    const openaiAdapter = new TestAdapter('gpt-4');
    const templateAdapter = new TestAdapter('template');

    router.registerAdapter(ModelProvider.OPENAI, openaiAdapter);
    router.registerAdapter(ModelProvider.TEMPLATE, templateAdapter);

    // Set cost limit below GPT-4 cost
    const selection = router.selectModel(TaskType.CODE_GENERATION, { prompt: 'quick query' }, 0.000001);
    expect(selection.provider).toBe(ModelProvider.TEMPLATE);
  });

  it('routes to adapter and throws if registered adapter is missing', async () => {
    const openaiAdapter = new TestAdapter('gpt-4');
    router.registerAdapter(ModelProvider.OPENAI, openaiAdapter);

    const routed = await router.route(TaskType.CODE_GENERATION, { prompt: 'code' });
    expect(routed.adapter).toBe(openaiAdapter);
    expect(routed.selection.provider).toBe(ModelProvider.OPENAI);
  });
});
