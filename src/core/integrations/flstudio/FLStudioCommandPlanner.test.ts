import { FLStudioCommandPlanner } from './FLStudioCommandPlanner';

describe('FLStudioCommandPlanner', () => {
  it('plans a dark trap F minor chord progression with Piano Roll actions', () => {
    const planner = new FLStudioCommandPlanner();
    const actions = planner.plan('Make a four-bar dark trap progression in F minor');

    expect(actions[0].tool).toBe('fl_get_piano_roll_state');
    expect(actions.filter(action => action.tool === 'fl_send_chord')).toHaveLength(4);
    expect(actions[1].args.notes).toEqual(['F3', 'Ab3', 'C4']);
  });

  it('adds root notes when the request mentions 808 or bass', () => {
    const planner = new FLStudioCommandPlanner();
    const actions = planner.plan('Add 808 root notes under a C minor progression');

    expect(actions.some(action => action.tool === 'fl_send_notes')).toBe(true);
    expect(actions.find(action => action.tool === 'fl_send_chord')?.args.notes).toEqual(['C3', 'Eb3', 'G3']);
  });

  it('plans mixer volume and pan changes', () => {
    const planner = new FLStudioCommandPlanner();
    const actions = planner.plan('Turn down track 3 by -3 dB and pan it left');

    expect(actions.map(action => action.tool)).toEqual(['fl_set_track_volume', 'fl_set_track_pan']);
    expect(actions[0].args.track).toBe(3);
    expect(actions[1].args.pan).toBeLessThan(0);
  });

  it('plans combined producer slang mixer moves', () => {
    const planner = new FLStudioCommandPlanner();
    const actions = planner.plan('turn my drums down a lil and throw the melody left');

    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tool: 'fl_set_track_volume',
        args: { track: 12, dbChange: -3 }
      }),
      expect.objectContaining({
        tool: 'fl_set_track_pan',
        args: { track: 6, pan: -0.35 }
      })
    ]));
  });
});
