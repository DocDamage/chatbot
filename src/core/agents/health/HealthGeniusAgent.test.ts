import { HealthGeniusAgent } from './HealthGeniusAgent';

describe('HealthGeniusAgent', () => {
  it('routes emergency red flags before normal coaching', async () => {
    const agent = new HealthGeniusAgent();

    const result = await agent.ask("I have chest pain and can't breathe.");

    expect(result.model).toBe('health-tools');
    expect(result.response).toContain('Emergency red flag detected');
    expect(result.response).toContain('Seek emergency help now');
    expect(result.response).toContain('RedFlagTriageTool');
  });

  it('creates nutrition macro estimates with safety boundaries', async () => {
    const agent = new HealthGeniusAgent();

    const result = await agent.nutrition('Give me macros for a 2200 calorie cut at 180 lb.');

    expect(result.response).toContain('NutritionMacroTool');
    expect(result.response).toContain('"proteinGrams": 144');
    expect(result.response).toContain('clinician');
  });

  it('builds a fitness plan with progression and stop rules', async () => {
    const agent = new HealthGeniusAgent();

    const result = await agent.fitness('Beginner 3 day strength workout plan.');

    expect(result.response).toContain('FitnessPlanTool');
    expect(result.response).toContain('Full-body strength');
    expect(result.response).toContain('Stop for chest pain');
  });

  it('explains anatomy without diagnosing', async () => {
    const agent = new HealthGeniusAgent();

    const result = await agent.anatomy('Explain knee anatomy and the meniscus.');

    expect(result.response).toContain('AnatomyLookupTool');
    expect(result.response).toContain('menisci');
    expect(result.response).toContain('without diagnosing');
  });

  it('checks medication safety without giving dose changes', async () => {
    const agent = new HealthGeniusAgent();

    const result = await agent.medication('Can I take ibuprofen with a blood thinner?');

    expect(result.response).toContain('MedicationInteractionWarningTool');
    expect(result.response).toContain('bleeding risk');
    expect(result.response).toContain('Do not start, stop, combine, or change medication dose');
  });
});
