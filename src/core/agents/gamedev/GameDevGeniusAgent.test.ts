import { describe, expect, it } from '@jest/globals';
import { GameDevGeniusAgent } from './GameDevGeniusAgent';
import { GameIntentClassifier } from './GameIntentClassifier';

describe('RT-AGENT-GD-001: GameDevGeniusAgent and Intent Classifier Suite', () => {
  it('classifies balance, engine code, prototype, shader, level, and design intents', () => {
    const classifier = new GameIntentClassifier();
    expect(classifier.classify('Calculate time-to-kill TTK with HP and DPS').kind).toBe('balance');
    expect(classifier.classify('Write GDScript for Godot character controller').kind).toBe('engine code');
    expect(classifier.classify('Create a playable scene prototype').kind).toBe('prototype');
    expect(classifier.classify('Write a water distortion shader material VFX').kind).toBe('shader');
    expect(classifier.classify('Design a boss encounter level map').kind).toBe('level');
    expect(classifier.classify('Core combat gameplay mechanics loop').kind).toBe('design');
  });

  it('uses balance simulation for time-to-kill questions', async () => {
    const agent = new GameDevGeniusAgent();

    const result = await agent.answer('My enemy has 500 HP and the player does 20 damage every 0.5 seconds. Is that too tanky?');

    expect(result.intent.kind).toBe('balance');
    expect(result.toolResults[0].tool).toBe('BalanceSimTool');
    expect(result.response).toContain('time-to-kill');
    expect(result.response).toContain('12.5 seconds');
  });

  it('handles general game design requests, prototypes, and reviews across engines', async () => {
    const agent = new GameDevGeniusAgent();

    const designResult = await agent.answer('Design a 2D platformer jump mechanic in Unity');
    expect(designResult.response).toContain('Engine track');

    const unityProto = await agent.prototype('Build a Unity inventory prototype');
    expect(unityProto).toBeDefined();

    const unrealProto = await agent.prototype('Unreal combat prototype');
    expect(unrealProto).toBeDefined();

    const phaserProto = await agent.prototype('Phaser arcade prototype');
    expect(phaserProto).toBeDefined();

    const review = await agent.review('Double jump mechanic with dash');
    expect(review.mechanic).toBeDefined();
    expect(review.level).toBeDefined();
    expect(review.engine).toBeDefined();
  });
});
