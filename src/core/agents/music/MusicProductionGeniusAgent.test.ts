import { MusicProductionGeniusAgent } from './MusicProductionGeniusAgent';

describe('MusicProductionGeniusAgent', () => {
  it('generates an 808 drum pattern from BPM/style prompts', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.beat('Give me an 808 pattern for 140 BPM dark trap.');

    expect(result.model).toBe('music-tools');
    expect(result.response).toContain('DrumPatternGeneratorTool');
    expect(result.response).toContain('140');
    expect(result.response).toContain('eightOhEight');
  });

  it('diagnoses muddy mixes with concrete checks', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.mix('Explain why my mix feels muddy.');

    expect(result.response).toContain('MixChecklistTool');
    expect(result.response).toContain('low-mid buildup');
    expect(result.response).toContain('180-450 Hz');
  });

  it('gives influence guidance without copying artists', async () => {
    const agent = new MusicProductionGeniusAgent();

    const result = await agent.ask('Make this loop feel more like early 2000s Neptunes.');

    expect(result.response).toContain('GenreInfluenceGraphTool');
    expect(result.response).toContain('original');
    expect(result.response).toContain('do not copy');
  });
});
