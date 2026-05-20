import { FLStepSequencerPatternTool } from '../../../tools/music/FLStepSequencerPatternTool';

export class FLPatternCoach {
  private tool = new FLStepSequencerPatternTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
