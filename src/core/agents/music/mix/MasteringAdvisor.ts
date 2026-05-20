import { AudioLoudnessMeterTool } from '../../../tools/audio/LoudnessMeterTool';
import { MasteringChecklistTool } from '../../../tools/music/MasteringChecklistTool';

export class MasteringAdvisor {
  private loudness = new AudioLoudnessMeterTool();
  private checklist = new MasteringChecklistTool();

  advise(input: Record<string, any>) {
    return {
      loudness: this.loudness.run(input),
      checklist: this.checklist.run(input),
      guardrail: 'Do not master over clipping, unclear low end, or an unbalanced vocal.'
    };
  }
}
