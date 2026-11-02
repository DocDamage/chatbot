import { FeedbackCollector } from '../FeedbackCollector';
import { PolicyOptimizer } from '../PolicyOptimizer';
import { FeedbackData, RewardModel, RewardSignal } from '../RewardModel';
import { SafeRL } from '../SafeRL';

function feedback(overrides: Partial<FeedbackData> = {}): FeedbackData {
  return {
    responseId: 'response-1',
    userId: 'user-1',
    sessionId: 'session-1',
    response: 'This is a coherent response with enough words to exercise the default branch.',
    ...overrides,
  };
}

function signal(overrides: Partial<RewardSignal> = {}): RewardSignal {
  return {
    userSatisfaction: 0.9,
    taskCompletion: 0.9,
    coherence: 0.9,
    safety: 0.9,
    overall: 0.9,
    ...overrides,
  };
}

describe('reinforcement-learning decision matrix', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('covers every reward source and task-completion decision', () => {
    const model = new RewardModel();

    expect(model.calculateReward(feedback({ userFeedback: { rating: 5 } })).userSatisfaction).toBe(1);
    expect(model.calculateReward(feedback({ userFeedback: { thumbsUp: true } })).userSatisfaction).toBe(0.9);
    const down = model.calculateReward(feedback({ userFeedback: { thumbsDown: true } }));
    expect(down.userSatisfaction).toBe(0.1);
    expect(down.safety).toBe(0.5);

    const implicit = model.calculateReward(feedback({
      implicitFeedback: {
        userContinued: true,
        userAskedFollowUp: true,
        responseTime: 100,
      },
    }));
    expect(implicit.userSatisfaction).toBeCloseTo(1);
    expect(implicit.taskCompletion).toBe(0.6);

    expect(model.calculateReward(feedback({
      implicitFeedback: {
        userContinued: true,
        userAskedFollowUp: false,
        responseTime: 5000,
      },
    })).taskCompletion).toBe(0.8);

    expect(model.calculateReward(feedback()).userSatisfaction).toBe(0.5);
  });

  it('covers coherence boundaries, repetition, average reward, and statistics', () => {
    const empty = new RewardModel();
    expect(empty.getAverageReward()).toBe(0.5);
    expect(empty.getStats()).toEqual({ totalFeedback: 0, averageReward: 0.5, recentAverage: 0.5 });

    const model = new RewardModel();
    expect(model.calculateReward(feedback({ response: 'short' })).coherence).toBe(0.6);
    expect(model.calculateReward(feedback({ response: 'x'.repeat(2001) })).coherence).toBe(0.7);
    expect(model.calculateReward(feedback({ response: 'one two three one two three one two three' })).coherence).toBe(0.6);
    expect(model.calculateReward(feedback()).coherence).toBe(0.8);
    expect(model.getAverageReward(2)).toBeGreaterThan(0);
    expect(model.getStats().totalFeedback).toBeGreaterThanOrEqual(4);
  });

  it('covers safe-RL constraint failures, penalties, exploration, and updates', () => {
    const safeRl = new SafeRL();
    expect(safeRl.isSafe(signal())).toBe(true);
    expect(safeRl.isSafe(signal({ safety: 0.69 }))).toBe(false);
    expect(safeRl.isSafe(signal({ coherence: 0.59 }))).toBe(false);
    expect(safeRl.isSafe(signal({ overall: 0.69 }))).toBe(false);
    expect(safeRl.adjustReward(signal())).toEqual(signal());
    expect(safeRl.adjustReward(signal({ safety: 0, overall: 0.2 })).overall).toBe(0);

    expect(safeRl.canExplore(0.49)).toBe(false);
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.05).mockReturnValueOnce(0.5);
    expect(safeRl.canExplore(0.8)).toBe(true);
    expect(safeRl.canExplore(0.8, 0.1)).toBe(false);

    safeRl.updateConstraints({ minSafety: 0.95 });
    expect(safeRl.isSafe(signal({ safety: 0.94 }))).toBe(false);
  });

  it('covers optimizer high reward, successful improvement, failure, prompts, and stats', async () => {
    const calculateReward = jest
      .fn()
      .mockReturnValueOnce(signal({ overall: 0.9 }))
      .mockReturnValueOnce(signal({
        overall: 0.4,
        userSatisfaction: 0.5,
        taskCompletion: 0.5,
        coherence: 0.5,
        safety: 0.5,
      }))
      .mockReturnValueOnce(signal({ overall: 0.4 }));
    const generate = jest.fn()
      .mockResolvedValueOnce({ content: 'Improved response' })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    const optimizer = new PolicyOptimizer({ calculateReward } as any, { generate } as any);

    expect(optimizer.getStats()).toEqual({ totalUpdates: 0, optimizationRate: 0, averageReward: 0 });
    await expect(optimizer.optimize('high', 'original', feedback(), 'context')).resolves.toEqual({
      optimized: false,
      reward: 0.9,
    });
    expect(generate).not.toHaveBeenCalled();

    const improved = await optimizer.optimize('low', 'original', feedback(), 'context');
    expect(improved).toEqual({ optimized: true, newResponse: 'Improved response', reward: 0.4 });
    expect(generate.mock.calls[0][0].prompt).toContain(
      'Make the response more helpful and engaging, Ensure the response fully addresses',
    );
    expect(generate.mock.calls[0][0].prompt).toContain('Improve the flow and coherence');
    expect(generate.mock.calls[0][0].prompt).toContain('Ensure the response is safe and appropriate');
    expect(optimizer.getStats()).toEqual({ totalUpdates: 1, optimizationRate: 0, averageReward: 0.4 });

    await expect(optimizer.optimize('failure', 'original', feedback(), 'context')).resolves.toEqual({
      optimized: false,
      reward: 0.4,
    });
  });

  it('covers feedback batching, pending snapshots, clearing, and readiness statistics', () => {
    const collector = new FeedbackCollector();
    expect(collector.getBatch()).toEqual([]);
    expect(collector.getStats()).toEqual({ total: 0, explicit: 0, implicit: 0, readyForBatch: false });

    collector.collectExplicit(feedback({ responseId: 'explicit' }));
    collector.collectImplicit(feedback({
      responseId: 'implicit',
      implicitFeedback: { userContinued: true, userAskedFollowUp: false, responseTime: 1 },
    }));
    collector.clearProcessed(['missing', 'explicit']);
    expect(collector.getAll().map(event => event.data.responseId)).toEqual(['implicit']);

    for (let index = 0; index < 9; index += 1) {
      collector.collectExplicit(feedback({ responseId: `batch-${index}` }));
    }
    expect(collector.getStats().readyForBatch).toBe(true);
    expect(collector.getBatch()).toHaveLength(10);
    expect(collector.getAll()).toEqual([]);
  });
});
