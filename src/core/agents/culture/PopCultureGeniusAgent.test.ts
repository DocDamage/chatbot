import { describe, expect, it, jest } from '@jest/globals';
import { PopCultureGeniusAgent } from './PopCultureGeniusAgent';
import { PopCultureIntentClassifier } from './PopCultureIntentClassifier';
import { PopCultureSourceRouter } from './PopCultureSourceRouter';

describe('RT-AGENT-CULT-001: PopCultureGeniusAgent and Intent Classifier Suite', () => {
  it('classifies timeline, franchise, compare, influence chain, and general pop culture intents', () => {
    const classifier = new PopCultureIntentClassifier();
    expect(classifier.classify('Build a timeline of cinematic releases').kind).toBe('timeline');
    expect(classifier.classify('Marvel Cinematic Universe Phase 3 franchise').kind).toBe('franchise');
    expect(classifier.classify('Compare sci-fi films of the 1980s').kind).toBe('compare');
    expect(classifier.classify('Which albums influenced modern synthwave?').kind).toBe('influence_chain');
    expect(classifier.classify('1990s video game culture').kind).toBe('historical_pop_culture');
  });

  it('routes sources appropriately based on domain query', () => {
    const router = new PopCultureSourceRouter();
    expect(router.route('star wars movie')).toContain('TMDB');
    expect(router.route('classic rock album')).toContain('MusicBrainz');
    expect(router.route('classic sci-fi novel')).toContain('Open Library');
    expect(router.route('general pop culture topic')).toContain('Wikidata');
  });

  it('keeps exact year facts out of the agent and delegates to source-backed metadata', async () => {
    const agent = new PopCultureGeniusAgent();

    const result = await agent.ask('tell me something from 1995');

    expect(result.response).toContain('1995');
    expect(result.response).toContain('Sources');
    expect(result.response).toContain('metadata for exact works');
  });

  it('surfaces a useful, user-facing answer for music-industry history', async () => {
    const chrono = { ask: jest.fn() } as any;
    const agent = new PopCultureGeniusAgent(chrono);

    const result = await agent.ask('tell me about the music industry in 1997');

    expect(chrono.ask).not.toHaveBeenCalled();
    expect(result.answerType).toBe('historical_music_industry');
    expect(result.response).toContain('physical releases');
    expect(result.response).toContain('Spice Girls');
    expect(result.response).not.toContain('Era\n{');
  });

  it('supports timeline, franchise graph, and comparison queries', async () => {
    const agent = new PopCultureGeniusAgent();

    const timeline = await agent.timeline('Star Wars original trilogy');
    expect(timeline.answerType).toBe('timeline');

    const franchise = await agent.franchise('MCU Phase 1');
    expect(franchise.answerType).toBe('franchise_graph');

    const comparison = await agent.compare('Star Trek vs Star Wars');
    expect(comparison.answerType).toBe('compare');
  });
});
