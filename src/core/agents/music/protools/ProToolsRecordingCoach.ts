import { ProToolsSessionSetupTool } from '../../../tools/music/ProToolsSessionSetupTool';
import { ProToolsSignalFlowTool } from '../../../tools/music/ProToolsSignalFlowTool';

export class ProToolsRecordingCoach {
  private setup = new ProToolsSessionSetupTool();
  private signal = new ProToolsSignalFlowTool();

  advise(input: string) {
    return {
      domain: 'music',
      component: 'ProToolsRecordingCoach',
      setup: this.setup.run({ query: input }),
      signalFlow: this.signal.run({ query: input })
    };
  }
}
