import { EnsembleAdapter } from '../EnsembleAdapter';
import { ModelRouter, TaskType, ModelProvider } from '../ModelRouter';
import { TemplateAdapter } from '../LLMAdapter';

describe('RT-ENS-001: EnsembleAdapter Consensus & Multi-Model Execution Suite', () => {
  let router: ModelRouter;
  let templateAdapter: TemplateAdapter;

  beforeEach(() => {
    router = new ModelRouter();
    templateAdapter = new TemplateAdapter();
    router.registerAdapter(ModelProvider.TEMPLATE, templateAdapter);
    router.registerAdapter(ModelProvider.OPENAI, templateAdapter);
    router.registerAdapter(ModelProvider.ANTHROPIC, templateAdapter);
    router.registerAdapter(ModelProvider.GOOGLE, templateAdapter);
    router.registerAdapter(ModelProvider.OLLAMA, templateAdapter);
    router.registerAdapter(ModelProvider.HUGGINGFACE, templateAdapter);
  });

  it('generates responses in single model mode (useEnsemble = false)', async () => {
    const ensemble = new EnsembleAdapter(router, false);
    const response = await ensemble.generate({ prompt: 'Hello world' });

    expect(response.content).toBeDefined();
    expect(response.model).toBeDefined();
    expect(ensemble.getModelName()).toBe('ensemble');
  });

  it('generates consensus response in ensemble mode with high agreement', async () => {
    const ensemble = new EnsembleAdapter(router, true);
    const response = await ensemble.generate({ prompt: 'Write a sorting function in python' });

    expect(response.content).toBeDefined();
    expect(response.model).toBeDefined();
  });

  it('estimates costs accurately for single model and ensemble modes', () => {
    const single = new EnsembleAdapter(router, false);
    const multi = new EnsembleAdapter(router, true);

    const costSingle = single.estimateCost({ prompt: 'calculate analysis and code' });
    const costMulti = multi.estimateCost({ prompt: 'calculate analysis and code' });

    expect(costSingle).toBeGreaterThanOrEqual(0);
    expect(costMulti).toBeGreaterThanOrEqual(costSingle);
  });

  it('infers task types correctly from prompt semantics', () => {
    const ensemble = new EnsembleAdapter(router, true);

    expect((ensemble as any).inferTaskType('write code function')).toBe(TaskType.CODE_GENERATION);
    expect((ensemble as any).inferTaskType('analyze and evaluate performance')).toBe(TaskType.ANALYSIS);
    expect((ensemble as any).inferTaskType('write a creative story')).toBe(TaskType.CREATIVE_WRITING);
    expect((ensemble as any).inferTaskType('explain how neural networks work')).toBe(TaskType.COMPLEX_REASONING);
    expect((ensemble as any).inferTaskType('short')).toBe(TaskType.SIMPLE_QUERY);
  });

  it('calculates response agreement and combines diverging responses', () => {
    const ensemble = new EnsembleAdapter(router, true);

    const r1 = { content: 'The capital of France is Paris.', model: 'm1' };
    const r2 = { content: 'Paris is the capital of France.', model: 'm2' };
    const agreement = (ensemble as any).calculateAgreement([r1, r2]);
    expect(agreement).toBeGreaterThan(0);

    const combined = (ensemble as any).combineResponses([r1, r2]);
    expect(combined.content).toBeDefined();
    expect(combined.model).toBe('ensemble');
  });
});
