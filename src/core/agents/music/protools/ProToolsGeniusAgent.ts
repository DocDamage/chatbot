import { ProToolsBusRoutingTool } from '../../../tools/music/ProToolsBusRoutingTool';
import { ProToolsEditWorkflowTool } from '../../../tools/music/ProToolsEditWorkflowTool';
import { ProToolsExportStemTool } from '../../../tools/music/ProToolsExportStemTool';
import { ProToolsPlaylistAdvisorTool } from '../../../tools/music/ProToolsPlaylistAdvisorTool';
import { ProToolsPostAudioTool } from '../../../tools/music/ProToolsPostAudioTool';
import { ProToolsSessionSetupTool } from '../../../tools/music/ProToolsSessionSetupTool';
import { ProToolsSignalFlowTool } from '../../../tools/music/ProToolsSignalFlowTool';
import { ProToolsVocalCompTool } from '../../../tools/music/ProToolsVocalCompTool';

export class ProToolsGeniusAgent {
  private sessionSetup = new ProToolsSessionSetupTool();
  private signalFlow = new ProToolsSignalFlowTool();
  private vocalComp = new ProToolsVocalCompTool();
  private playlistAdvisor = new ProToolsPlaylistAdvisorTool();
  private editWorkflow = new ProToolsEditWorkflowTool();
  private busRouting = new ProToolsBusRoutingTool();
  private exportStem = new ProToolsExportStemTool();
  private postAudio = new ProToolsPostAudioTool();

  ask(query: string) {
    const setup = this.sessionSetup.run({ query });
    const signal = this.signalFlow.run({ query });
    const comp = this.vocalComp.run({ query });
    const playlists = this.playlistAdvisor.run({ query });
    const editing = this.editWorkflow.run({ query });
    const routing = this.busRouting.run({ query });
    const exportStem = this.exportStem.run({ query });
    const post = this.postAudio.run({ query });

    return {
      domain: 'music',
      mode: 'pro_tools',
      response: [
        'Pro Tools Genius',
        '',
        `Goal: ${query}`,
        '',
        'Session setup:',
        ...setup.setup.map(step => `- ${step}`),
        '',
        'Signal flow:',
        `- ${signal.signalFlow.join(' -> ')}`,
        `- ${signal.note}`,
        '',
        'Recording/editing workflow:',
        ...comp.workflow.map(step => `- ${step}`),
        ...playlists.tips.map(step => `- ${step}`),
        ...editing.editing.map(step => `- ${step}`),
        '',
        'Routing/post:',
        ...routing.routing.map(step => `- ${step}`),
        ...post.postWorkflow.map(step => `- ${step}`),
        '',
        'Delivery/export:',
        ...exportStem.export.map(step => `- ${step}`)
      ].join('\n'),
      sources: ['knowledge-base-public/music/protools'],
      guardrails: ['Use Avid docs for version-specific Pro Tools behavior.', 'Do not confuse MIDI-only tracks with audio recording tracks.'],
      tools: ['ProToolsSessionSetupTool', 'ProToolsSignalFlowTool', 'ProToolsVocalCompTool', 'ProToolsPlaylistAdvisorTool', 'ProToolsEditWorkflowTool', 'ProToolsBusRoutingTool', 'ProToolsExportStemTool', 'ProToolsPostAudioTool'],
      model: 'pro-tools-tools'
    };
  }
}
