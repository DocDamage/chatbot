import { describe, expect, it } from '@jest/globals';
import { GamingGeniusAgent } from './GamingGeniusAgent';
import { GamingIntentClassifier } from './GamingIntentClassifier';
import { GamingKnowledgeRouter } from './GamingKnowledgeRouter';

describe('RT-AGENT-GAME-001: GamingGeniusAgent and Intent Classifier Suite', () => {
  it('classifies speedrunning, lore, modding, platform, strategy, gamedev, and game analysis intents', () => {
    const classifier = new GamingIntentClassifier();
    expect(classifier.classify('Plan any% glitchless speedrun route').kind).toBe('speedrunning');
    expect(classifier.classify('Explain the lore timeline and true ending').kind).toBe('lore');
    expect(classifier.classify('How to create a rom hack mod or use a save editor').kind).toBe('modding');
    expect(classifier.classify('Steam Deck vs Switch hardware console platform differences').kind).toBe('platform');
    expect(classifier.classify('Ranked esports meta strategy and matchup tier list').kind).toBe('strategy');
    expect(classifier.classify('Implement a Godot player controller script').kind).toBe('gamedev');
    expect(classifier.classify('Analyze combat game feel and economy progression').kind).toBe('game analysis');
    expect(classifier.classify('What are fun video games?').kind).toBe('gaming');
  });

  it('routes to recommended sources based on intent', () => {
    const router = new GamingKnowledgeRouter();
    expect(router.recommendedSources('lore')).toContain('official wiki or publisher materials');
    expect(router.recommendedSources('speedrunning')).toContain('speedrun.com rules/resources');
    expect(router.recommendedSources('platform')).toContain('platform holder documentation');
    expect(router.recommendedSources('modding')).toContain('official modding docs');
    expect(router.recommendedSources('gaming')).toContain('local gaming knowledge base');
  });

  it('answers broad gaming questions without forcing them into gamedev only', async () => {
    const agent = new GamingGeniusAgent();
    const result = await agent.ask('How does speedrunning route planning work in Metroidvanias?');

    expect(result.mode).toBe('gaming');
    expect(result.intent.kind).toBe('speedrunning');
    expect(result.response).toContain('speedrunning');
    expect(result.response).toContain('Verification');
  });

  it('delegates implementation-style game development questions', async () => {
    const agent = new GamingGeniusAgent();
    const result = await agent.ask('Prototype a Godot platformer controller');

    expect(result.delegatedTo).toBe('gamedev');
    expect(result.response).toContain('Implementation plan');
  });
});
