import { DrumPatternTool } from './DrumPatternTool';

export class FLStepSequencerPatternTool {
  private drumPattern = new DrumPatternTool();

  run(input: Record<string, any> = {}) {
    const pattern = this.drumPattern.run({ ...input, daw: 'fl_studio' });
    return {
      ...pattern,
      domain: 'music',
      tool: 'FLStepSequencerPatternTool',
      flSteps: [
        'Sketch kick, clap/snare, hat, perc, and 808 channels in Channel Rack.',
        'Send each important channel to its own Mixer insert.',
        'Move detailed rolls/slides into Piano Roll once the groove works.'
      ]
    };
  }
}
