import { describe, expect, it } from '@jest/globals';
import { HistoryGeniusAgent } from '../HistoryGeniusAgent';
import { HistoryIntentClassifier } from '../HistoryIntentClassifier';

describe('RT-AGENT-HIST-001: HistoryGeniusAgent and Intent Classifier Suite', () => {
  it('classifies timeline, compare, primary source, cause/effect, and general context intents', () => {
    const classifier = new HistoryIntentClassifier();
    expect(classifier.classify('Build a timeline of the Roman Republic').kind).toBe('timeline');
    expect(classifier.classify('Compare Athens and Sparta governance').kind).toBe('compare_civilizations');
    expect(classifier.classify('Read the primary source Magna Carta').kind).toBe('primary_source_explanation');
    expect(classifier.classify('Why did the Bronze Age collapse and what was the cause?').kind).toBe('cause_effect');
    expect(classifier.classify('Describe the Renaissance in Florence').kind).toBe('historical_context');
  });

  it('answers historical queries with chronology, evidence, actors, and causality', async () => {
    const agent = new HistoryGeniusAgent();
    const result = await agent.ask('Why did the Western Roman Empire fall in 476 AD?');

    expect(result.answerType).toBe('cause_effect');
    expect(result.response).toBeDefined();
    expect(Array.isArray(result.causes)).toBe(true);
    expect(Array.isArray(result.consequences)).toBe(true);
  });

  it('builds timelines, civilization comparisons, and primary source retrievals', async () => {
    const agent = new HistoryGeniusAgent();

    const timeline = await agent.timeline('French Revolution');
    expect(timeline.answerType).toBe('timeline');

    const comparison = await agent.compare('Compare Roman Republic and Roman Empire');
    expect(comparison.answerType).toBe('compare_civilizations');
    expect(comparison.graph).toBeDefined();

    const sources = await agent.primarySources('Code of Hammurabi');
    expect(sources.answerType).toBe('primary_sources');
  });
});
