export interface FLStudioToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
}

const NOTE_RE = /^[A-G](?:#|b)?-?\d$/i;

export class FLStudioCommandPlanner {
  plan(input: string): FLStudioToolAction[] {
    const text = input.toLowerCase();

    if (/\bstatus|state|what.*loaded|read.*piano roll|notes.*there\b/.test(text)) {
      return [
        { tool: 'fl_get_transport_status', args: {}, description: 'Read FL Studio transport status.' },
        { tool: 'fl_get_piano_roll_state', args: {}, description: 'Read the active Piano Roll state.' }
      ];
    }

    if (/\bplay\b/.test(text)) return [{ tool: 'fl_play', args: {}, description: 'Start FL Studio playback.' }];
    if (/\bstop\b/.test(text)) return [{ tool: 'fl_stop', args: {}, description: 'Stop FL Studio playback.' }];
    if (/\brecord\b/.test(text)) return [{ tool: 'fl_record', args: {}, description: 'Toggle or start recording in FL Studio.' }];

    if (/\b(turn down|volume|pan|left|right|mixer|track)\b/.test(text)) {
      return this.planMixer(input);
    }

    if (/\b(kick|snare|clap|hat|hi-hat|step sequence|channel rack)\b/.test(text)) {
      return this.planStepSequence(input);
    }

    if (/\b(chord|progression|melody|piano roll|notes?|808|bass)\b/.test(text)) {
      return this.planPianoRoll(input);
    }

    return [
      { tool: 'fl_get_transport_status', args: {}, description: 'Check FL Studio transport state before planning.' },
      { tool: 'fl_get_all_channels', args: {}, description: 'Read channels so the next command can target the right instrument.' }
    ];
  }

  private planPianoRoll(input: string): FLStudioToolAction[] {
    const text = input.toLowerCase();
    const progression = this.getProgression(text);
    const duration = /\b(half|halftime|fast)\b/.test(text) ? 1 : 2;

    const actions: FLStudioToolAction[] = [
      { tool: 'fl_get_piano_roll_state', args: {}, description: 'Inspect active Piano Roll before adding notes.' }
    ];

    progression.forEach((chord, index) => {
      actions.push({
        tool: 'fl_send_chord',
        args: {
          notes: chord.notes,
          time: index * duration,
          duration,
          velocity: 92
        },
        description: `Send ${chord.name} chord to the active Piano Roll.`
      });
    });

    if (/\b808|bass\b/.test(text)) {
      progression.forEach((chord, index) => {
        actions.push({
          tool: 'fl_send_notes',
          args: {
            notes: [{ note: chord.root, time: index * duration, duration, velocity: 105 }],
            channel: 'selected'
          },
          description: `Add 808/root note under ${chord.name}.`
        });
      });
    }

    return actions;
  }

  private getProgression(text: string): Array<{ name: string; root: string; notes: string[] }> {
    if (/c minor|cm\b/.test(text)) {
      return [
        { name: 'Cm', root: 'C2', notes: ['C3', 'Eb3', 'G3'] },
        { name: 'Ab', root: 'Ab1', notes: ['Ab2', 'C3', 'Eb3'] },
        { name: 'Eb', root: 'Eb2', notes: ['Eb3', 'G3', 'Bb3'] },
        { name: 'Bb', root: 'Bb1', notes: ['Bb2', 'D3', 'F3'] }
      ];
    }

    if (/dark|trap|f minor|fm\b/.test(text)) {
      return [
        { name: 'Fm', root: 'F2', notes: ['F3', 'Ab3', 'C4'] },
        { name: 'Db', root: 'Db2', notes: ['Db3', 'F3', 'Ab3'] },
        { name: 'Ab', root: 'Ab1', notes: ['Ab2', 'C3', 'Eb3'] },
        { name: 'Eb', root: 'Eb2', notes: ['Eb3', 'G3', 'Bb3'] }
      ];
    }

    const explicitNotes = text
      .split(/\s|,|-/)
      .map(part => part.trim())
      .filter(part => NOTE_RE.test(part));

    if (explicitNotes.length > 0) {
      return [{ name: 'custom notes', root: explicitNotes[0], notes: explicitNotes }];
    }

    return [
      { name: 'Am', root: 'A1', notes: ['A2', 'C3', 'E3'] },
      { name: 'F', root: 'F1', notes: ['F2', 'A2', 'C3'] },
      { name: 'C', root: 'C2', notes: ['C3', 'E3', 'G3'] },
      { name: 'G', root: 'G1', notes: ['G2', 'B2', 'D3'] }
    ];
  }

  private planStepSequence(input: string): FLStudioToolAction[] {
    const text = input.toLowerCase();
    const channel = text.includes('snare') || text.includes('clap')
      ? 'snare'
      : text.includes('hat')
        ? 'hi-hat'
        : 'kick';

    const steps = channel === 'hi-hat'
      ? [0, 2, 4, 6, 8, 10, 12, 14]
      : channel === 'snare'
        ? [4, 12]
        : [0, 6, 10, 14];

    return [
      { tool: 'fl_get_all_channels', args: {}, description: 'Read channels before setting the step sequencer.' },
      {
        tool: 'fl_set_step_sequence',
        args: { channel, steps, length: 16 },
        description: `Set a ${channel} step sequence.`
      }
    ];
  }

  private planMixer(input: string): FLStudioToolAction[] {
    const text = input.toLowerCase();
    const track = Number(text.match(/track\s+(\d+)/)?.[1] || text.match(/mixer\s+(\d+)/)?.[1] || 1);
    const actions: FLStudioToolAction[] = [];

    const dbChange = Number(text.match(/(-?\d+(?:\.\d+)?)\s*dB/i)?.[1] || (text.includes('turn down') ? -3 : 0));
    if (text.includes('volume') || text.includes('turn down') || /\d+\s*dB/i.test(input)) {
      actions.push({
        tool: 'fl_set_track_volume',
        args: { track, dbChange },
        description: `Adjust mixer track ${track} volume by ${dbChange} dB.`
      });
    }

    if (text.includes('pan') || text.includes('left') || text.includes('right')) {
      const pan = text.includes('left') ? -0.35 : text.includes('right') ? 0.35 : 0;
      actions.push({
        tool: 'fl_set_track_pan',
        args: { track, pan },
        description: `Set mixer track ${track} pan.`
      });
    }

    if (text.includes('solo')) {
      actions.push({ tool: 'fl_solo_track', args: { track, solo: true }, description: `Solo mixer track ${track}.` });
    }

    if (text.includes('mute')) {
      actions.push({ tool: 'fl_mute_track', args: { track, muted: true }, description: `Mute mixer track ${track}.` });
    }

    return actions.length > 0 ? actions : [{ tool: 'fl_get_transport_status', args: {}, description: 'Check FL Studio before mixer edits.' }];
  }
}
