import { FLPianoRollTool } from '../../../tools/music/FLPianoRollTool';

export class FLPianoRollCoach {
  private tool = new FLPianoRollTool();

  advise(input: string) {
    return this.tool.run({ query: input });
  }
}
