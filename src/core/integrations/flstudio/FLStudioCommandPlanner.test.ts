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

    const rightAction = planner.plan('throw melody right');
    expect(rightAction.some(a => a.tool === 'fl_set_track_pan' && a.args.pan === 0.35)).toBe(true);
  });

  it('covers transport controls: play, stop, record, status and fallback', () => {
    const planner = new FLStudioCommandPlanner();
    expect(planner.plan('play the track')[0].tool).toBe('fl_play');
    expect(planner.plan('stop the playback')[0].tool).toBe('fl_stop');
    expect(planner.plan('record now')[0].tool).toBe('fl_record');
    expect(planner.plan('what is the status and what is loaded')[0].tool).toBe('fl_get_transport_status');
    expect(planner.plan('completely random prompt')[0].tool).toBe('fl_get_transport_status');
  });

  it('covers track state planning: solo, mute, kill, take out across all track types', () => {
    const planner = new FLStudioCommandPlanner();
    const soloMelody = planner.plan('solo the melody');
    expect(soloMelody.some(a => a.tool === 'fl_solo_track' && a.args.track === 6)).toBe(true);

    const muteKick = planner.plan('kill the kick');
    expect(muteKick.some(a => a.tool === 'fl_mute_track' && a.args.track === 1)).toBe(true);

    const muteSnare = planner.plan('mute the snare');
    expect(muteSnare.some(a => a.tool === 'fl_mute_track' && a.args.track === 2)).toBe(true);

    const muteHat = planner.plan('take out the hat');
    expect(muteHat.some(a => a.tool === 'fl_mute_track' && a.args.track === 3)).toBe(true);

    const muteBeat = planner.plan('mute the beat');
    expect(muteBeat.some(a => a.tool === 'fl_mute_track' && a.args.track === 13)).toBe(true);
  });

  it('covers step sequence planning for hi-hat, snare, and kick', () => {
    const planner = new FLStudioCommandPlanner();
    const hiHatBounce = planner.plan('make hi-hat bounce in channel rack');
    expect(hiHatBounce.some(a => a.tool === 'fl_set_step_sequence' && a.args.channel === 'hi-hat')).toBe(true);

    const hiHatStraight = planner.plan('regular hi-hat step sequence');
    expect(hiHatStraight.some(a => a.tool === 'fl_set_step_sequence' && a.args.channel === 'hi-hat')).toBe(true);

    const snareSequence = planner.plan('clap step sequence');
    expect(snareSequence.some(a => a.tool === 'fl_set_step_sequence' && a.args.channel === 'snare')).toBe(true);

    const kickSequence = planner.plan('kick drums knock step sequence');
    expect(kickSequence.some(a => a.tool === 'fl_set_step_sequence' && a.args.channel === 'kick')).toBe(true);
  });

  it('covers explicit notes, halftime, and default A minor progressions', () => {
    const planner = new FLStudioCommandPlanner();
    const customNotes = planner.plan('chord notes C3 Eb3 G3 on piano roll');
    expect(customNotes.filter(a => a.tool === 'fl_send_chord')).toHaveLength(1);

    const defaultAmHalftime = planner.plan('halftime chord melody');
    expect(defaultAmHalftime.some(a => a.tool === 'fl_send_chord' && a.args.duration === 1)).toBe(true);
  });

  it('covers explicit dB, turn up, bring up, solo and mute in mixer', () => {
    const planner = new FLStudioCommandPlanner();
    const bringUp = planner.plan('bring up track 4 volume by 4 dB and pan right');
    expect(bringUp.some(a => a.tool === 'fl_set_track_volume' && a.args.dbChange === 4)).toBe(true);
    expect(bringUp.some(a => a.tool === 'fl_set_track_pan' && a.args.pan === 0.35)).toBe(true);

    const soloMixer = planner.plan('solo track 7 in mixer');
    expect(soloMixer.some(a => a.tool === 'fl_solo_track' && a.args.track === 7)).toBe(true);

    const muteMixer = planner.plan('mute track 9 in mixer');
    expect(muteMixer.some(a => a.tool === 'fl_mute_track' && a.args.track === 9)).toBe(true);

    const genericMixer = planner.plan('mixer');
    expect(genericMixer[0].tool).toBe('fl_get_transport_status');
  });
});
