import { TestStrategyPlanner } from './TestStrategy';

describe('TestStrategyPlanner', () => {
  it('adds regression and security cases based on task risk', () => {
    const strategy = new TestStrategyPlanner().plan({ intent: 'debug_error', languages: ['python'], files: ['app.py'], existingTests: ['tests/test_app.py'], acceptanceCriteria: ['reject invalid input'] });
    expect(strategy.commands).toEqual(['pytest']);
    expect(strategy.cases).toEqual(expect.arrayContaining(['original failure reproduction', 'expected error handling']));
  });
});
