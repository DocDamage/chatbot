import { RoleplaySessionEngine } from '../RoleplaySessionEngine';

describe('B75-07: RoleplaySessionEngine Decision Matrix', () => {
  let engine: RoleplaySessionEngine;

  beforeEach(() => {
    engine = new RoleplaySessionEngine();
  });

  it('starts session, records IC/OOC/narration turns, and manages pause/resume lifecycle', () => {
    const session = engine.start({
      sessionId: 'sess_1',
      sceneLocation: 'Enchanted Forest',
      activeCast: ['Hero', 'Wizard'],
      goals: ['Retrieve artifact'],
      inventory: ['Magic Wand'],
      boundaries: {
        hardLimits: ['extreme_violence'],
        disallowedThemes: ['nsfw'],
        allowedMatureThemes: ['fantasy_combat'],
        fadeToBlack: true
      }
    });

    expect(session.id).toBe('sess_1');
    expect(session.paused).toBe(false);

    const sWithTurn1 = engine.recordTurn('sess_1', { speaker: 'Hero', text: 'I cast light spell.', mode: 'ic' });
    const sWithTurn2 = engine.recordTurn('sess_1', { speaker: 'Player', text: 'How much mana left?', mode: 'ooc' });
    expect(sWithTurn2.turnHistory.length).toBe(2);

    const paused = engine.pause('sess_1');
    expect(paused.paused).toBe(true);

    const resumed = engine.resume('sess_1');
    expect(resumed.paused).toBe(false);
  });

  it('branches sessions with cloned histories and generates summaries', () => {
    engine.start({
      sessionId: 'root_sess',
      sceneLocation: 'Castle Gate',
      activeCast: ['Knight']
    });
    engine.recordTurn('root_sess', { speaker: 'Knight', text: 'Halt!' });

    const branched = engine.branch('root_sess', 'Alternate Choice');
    expect(branched.parentSessionId).toBe('root_sess');
    expect(branched.branchName).toBe('Alternate Choice');
    expect(branched.turnHistory.length).toBe(1);

    const summary = engine.summarize('root_sess');
    expect(summary).toContain('Session: root_sess');
    expect(summary).toContain('Castle Gate');
    expect(summary).toContain('Knight');

    const reset = engine.reset('root_sess');
    expect(reset.turnHistory.length).toBe(0);
  });

  it('throws for unknown session lookups', () => {
    expect(() => engine.get('nonexistent')).toThrow('Roleplay session not found');
  });
});
