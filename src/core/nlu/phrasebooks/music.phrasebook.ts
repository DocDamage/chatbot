import { Phrasebook } from '../DomainPhrasebook';

export const musicPhrasebook: Phrasebook = [
  {
    phrases: ['make it slap', 'make it hit', 'make it knock', 'make it bang', 'make the drums knock', 'make the snare crack'],
    intent: 'mix.energy',
    meaning: 'increase perceived impact, punch, loudness, groove, or transient energy',
    domain: 'music',
    route: 'mix_master',
    slots: { goal: 'more impact' }
  },
  {
    phrases: ['make the 808 slap', '808 slap', '808 hit harder', 'bass hit harder'],
    intent: 'mix.low_end_impact',
    meaning: 'make the bass feel powerful while keeping it controlled',
    domain: 'music',
    route: 'mix_master',
    slots: { target: '808', goal: 'stronger low end' }
  },
  {
    phrases: ['808 is eating the kick', '808 eating the kick', 'kick and 808 fighting', 'low end muddy', 'stop it from eating the kick'],
    intent: 'mix.low_end_masking',
    meaning: 'kick and bass frequencies are masking each other',
    domain: 'music',
    route: 'mix_master',
    slots: { target: '808', problem: 'kick masking', goal: 'stronger low end without masking' },
    confidence: 0.9
  },
  {
    phrases: ['vocals buried', 'vocals not sitting', 'vocal not sitting', 'vocal ain’t sitting right', 'vocals ain’t sitting right', 'vocals aint sitting right'],
    intent: 'mix.vocal_balance',
    meaning: 'vocal level, EQ, compression, or space needs adjustment',
    domain: 'music',
    route: 'mix_master',
    slots: { target: 'vocal', problem: 'buried vocal' }
  },
  {
    phrases: ['too boxy', 'sounds boxy', 'make it less boxy', 'less boxy', 'low mids cooked', 'low end is cooked', 'mix sounds muddy', 'less muddy', 'make it sound expensive'],
    intent: 'mix.low_mid_mud',
    meaning: 'reduce low-mid buildup, often around 200-500 Hz',
    domain: 'music',
    route: 'mix_master',
    slots: { problem: 'mud/boxiness' }
  },
  {
    phrases: ['too harsh', 'hurts my ears', 'too sharp'],
    intent: 'mix.harshness',
    meaning: 'reduce harsh high-mid or treble frequencies',
    domain: 'music',
    route: 'mix_master',
    slots: { problem: 'harshness' }
  },
  {
    phrases: ['make it bounce', 'needs more bounce', 'put it in the pocket', 'give it more pocket', 'hats are too busy', 'make hats bounce'],
    intent: 'beat.groove',
    meaning: 'improve rhythm, swing, velocity, timing, and groove',
    domain: 'music',
    route: 'music',
    slots: { goal: 'better groove' }
  },
  {
    phrases: ['cook up a beat', 'make me a beat', 'lay down drums', 'sauce up the hook'],
    intent: 'beat.create',
    meaning: 'generate drum, beatmaking, hook, or arrangement guidance',
    domain: 'music',
    route: 'music'
  },
  {
    phrases: ['logic pro', 'stock logic pro vocal chain', 'logic vocal chain', 'logic stock plugins'],
    intent: 'logic.workflow',
    meaning: 'Logic Pro workflow, stock plugins, vocal chain, MIDI, or arrangement help',
    domain: 'music',
    route: 'music',
    slots: { software: 'logic_pro' }
  },
  {
    phrases: ['bounce it down', 'print it', 'render it'],
    intent: 'daw.export',
    meaning: 'export or render audio',
    domain: 'music',
    route: 'fl_studio_control',
    slots: { action: 'render/export' },
    confidence: 0.82
  },
  {
    phrases: ['kill the melody', 'take the melody out', 'mute the melody'],
    intent: 'fl_studio_control.mute',
    meaning: 'mute or remove a part; mute should be planned before destructive removal',
    domain: 'fl_studio_control',
    route: 'fl_studio_control',
    slots: { target: 'melody', action: 'mute' }
  },
  {
    phrases: ['throw the melody left', 'pan the melody left', 'melody left'],
    intent: 'mixer.adjust',
    meaning: 'pan the melody toward the left side',
    domain: 'fl_studio_control',
    route: 'fl_studio_control',
    slots: { target: 'melody', action: 'pan_left' }
  },
  {
    phrases: ['solo the drums', 'mute the beat', 'take the beat out'],
    intent: 'fl_studio_control.track_state',
    meaning: 'change mute/solo state for drum or instrument tracks',
    domain: 'fl_studio_control',
    route: 'fl_studio_control',
    confidence: 0.78
  }
];
