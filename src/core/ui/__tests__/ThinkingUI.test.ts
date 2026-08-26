import { describe, expect, it, jest } from '@jest/globals';
import { ThinkingUI } from '../ThinkingUI';

describe('RT-UI-001: ThinkingUI Chain-of-Thought Visualization Suite', () => {
  it('manages thinking session lifecycle and emits step callbacks', () => {
    const ui = new ThinkingUI({ enabled: true });
    const callback = jest.fn();
    ui.onThinking(callback);

    const sessionId = ui.startSession('Design high-throughput ingestion pipeline');
    expect(sessionId).toBeDefined();

    ui.addStep('Detected kafka streaming requirement', 'observation', sessionId);
    ui.addStep('Evaluating partitioning strategy', 'reasoning', sessionId);
    ui.addStep('Adopted key-based murmur2 partitioning', 'decision', sessionId);

    expect(callback).toHaveBeenCalledTimes(3);

    ui.completeSession('Pipeline architecture design finalized', sessionId);
    const session = ui.getSession(sessionId);
    expect(session?.finalAnswer).toBe('Pipeline architecture design finalized');
    expect(session?.steps).toHaveLength(3);
  });
});
