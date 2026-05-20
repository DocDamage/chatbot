import { StoryGeniusAgent } from './StoryGeniusAgent';

describe('StoryGeniusAgent', () => {
  it('builds worldbuilding scaffolds for faction/city prompts', async () => {
    const agent = new StoryGeniusAgent();

    const result = await agent.worldbuild('Build a faction backstory for a neon city RPG.');

    expect(result.model).toBe('story-tools');
    expect(result.response).toContain('LoreBibleTool');
    expect(result.response).toContain('cyberpunk');
    expect(result.response).toContain('Factions');
  });

  it('creates character arc structure for boss prompts', async () => {
    const agent = new StoryGeniusAgent();

    const result = await agent.character('Design a tragic boss character.');

    expect(result.response).toContain('CharacterArcTool');
    expect(result.response).toContain('boss character');
    expect(result.response).toContain('Choice');
  });

  it('gives dialogue tone guidance', async () => {
    const agent = new StoryGeniusAgent();

    const result = await agent.dialogue('Make this argument tense but subtle.');

    expect(result.response).toContain('DialogueToneTool');
    expect(result.response).toContain('subtext');
    expect(result.response).toContain('ScenePacingTool');
  });

  it('runs continuity checks for canon prompts', async () => {
    const agent = new StoryGeniusAgent();

    const result = await agent.continuity('Check this scene for timeline contradictions.');

    expect(result.response).toContain('ContinuityCheckerTool');
    expect(result.response).toContain('Timeline');
  });
});
