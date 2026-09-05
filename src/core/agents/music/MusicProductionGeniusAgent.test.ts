import { describe, expect, it } from '@jest/globals';
import { MusicProductionGeniusAgent } from './MusicProductionGeniusAgent';
import { MusicIntentClassifier } from './MusicIntentClassifier';

describe('RT-AGENT-MUS-001: MusicProductionGeniusAgent and Music Intent Classifier Suite', () => {
  it('classifies all music production intents', () => {
    const classifier = new MusicIntentClassifier();
    expect(classifier.classify('Generate a Suno prompt for a song with style tag')).toBe('suno');
    expect(classifier.classify('How do I use the FL Studio channel rack and piano roll?')).toBe('fl_studio');
    expect(classifier.classify('Set up Pro Tools clip gain and aux send')).toBe('pro_tools');
    expect(classifier.classify('Use Logic Pro flex pitch on vocals')).toBe('logic');
    expect(classifier.classify('Translate daw session stems to another format')).toBe('daw_translate');
    expect(classifier.classify('Master track to -14 LUFS with true peak limiter')).toBe('master');
    expect(classifier.classify('Clean up vocal chain EQ and compressor to avoid masking')).toBe('mix');
    expect(classifier.classify('Song structure intro verse chorus bridge drop hook')).toBe('arrangement');
    expect(classifier.classify('Cook up an 808 kick and hi-hat pattern')).toBe('beat');
    expect(classifier.classify('Chord progression in minor key scale harmony')).toBe('theory');
    expect(classifier.classify('Living artist licensing and copyright rules')).toBe('copyright');
    expect(classifier.classify('Music equipment advice')).toBe('general');
  });

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
