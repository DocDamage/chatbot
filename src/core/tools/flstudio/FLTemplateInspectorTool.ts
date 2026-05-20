export class FLTemplateInspectorTool {
  run() {
    return {
      domain: 'flstudio',
      tool: 'FLTemplateInspectorTool',
      expectedTracks: {
        1: 'Kick',
        2: 'Snare/Clap',
        3: 'Hats',
        4: 'Percs',
        5: '808/Bass',
        6: 'Melody',
        7: 'Counter Melody',
        8: 'Lead Vocal',
        9: 'Adlibs',
        10: 'Vocal Doubles',
        11: 'FX',
        12: 'Drum Bus',
        13: 'Music Bus',
        14: 'Vocal Bus',
        15: 'Reverb Send',
        16: 'Delay Send',
        17: 'Master'
      },
      pluginSlots: [
        'Parametric EQ 2 before compression where possible.',
        'Use sends for reverb/delay instead of heavy wet inserts.',
        'Keep master limiter changes confirmation-gated.'
      ]
    };
  }
}
