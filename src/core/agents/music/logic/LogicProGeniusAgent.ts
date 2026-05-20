import { LogicAlchemyAdvisorTool } from '../../../tools/music/LogicAlchemyAdvisorTool';
import { LogicArrangementMarkerTool } from '../../../tools/music/LogicArrangementMarkerTool';
import { LogicBounceExportTool } from '../../../tools/music/LogicBounceExportTool';
import { LogicDrummerSessionPlayerTool } from '../../../tools/music/LogicDrummerSessionPlayerTool';
import { LogicMidiWorkflowTool } from '../../../tools/music/LogicMidiWorkflowTool';
import { LogicProjectSetupTool } from '../../../tools/music/LogicProjectSetupTool';
import { LogicStockPluginChainTool } from '../../../tools/music/LogicStockPluginChainTool';
import { LogicVocalChainTool } from '../../../tools/music/LogicVocalChainTool';

export class LogicProGeniusAgent {
  private projectSetup = new LogicProjectSetupTool();
  private midiWorkflow = new LogicMidiWorkflowTool();
  private sessionPlayer = new LogicDrummerSessionPlayerTool();
  private vocalChain = new LogicVocalChainTool();
  private alchemy = new LogicAlchemyAdvisorTool();
  private stockChain = new LogicStockPluginChainTool();
  private bounceExport = new LogicBounceExportTool();
  private arrangementMarkers = new LogicArrangementMarkerTool();

  ask(query: string) {
    const setup = this.projectSetup.run({ query });
    const midi = this.midiWorkflow.run({ query });
    const session = this.sessionPlayer.run({ query });
    const vocal = this.vocalChain.run({ query: `${query} Logic Pro`, daw: 'logic' });
    const alchemy = this.alchemy.run({ query });
    const stock = this.stockChain.run({ query });
    const bounce = this.bounceExport.run({ query });
    const markers = this.arrangementMarkers.run({ query });
    return {
      domain: 'music',
      mode: 'logic',
      response: [
        'Logic Pro Genius',
        '',
        `Goal: ${query}`,
        '',
        'Logic workflow:',
        ...setup.setup.map(step => `- ${step}`),
        ...midi.workflow.map(step => `- ${step}`),
        `- Arrangement markers: ${markers.markers.join(', ')}`,
        '',
        'Stock plugin chain:',
        `- ${vocal.chain.join(' -> ')}`,
        `- Vocal stock map: ${stock.chains.vocal.join(' -> ')}`,
        '',
        'Session Players / Drummer:',
        ...session.workflow.map(step => `- ${step}`),
        '',
        'Alchemy / sound design:',
        ...alchemy.advice.map(step => `- ${step}`),
        '',
        'Bounce/export:',
        ...bounce.checklist.map(step => `- ${step}`)
      ].join('\n'),
      sources: ['knowledge-base-public/music/logic'],
      guardrails: ['Use Apple Logic Pro User Guide for version-specific behavior.', 'Avoid requiring third-party plugins for stock-chain requests.'],
      tools: ['LogicProjectSetupTool', 'LogicMidiWorkflowTool', 'LogicDrummerSessionPlayerTool', 'LogicVocalChainTool', 'LogicAlchemyAdvisorTool', 'LogicStockPluginChainTool', 'LogicBounceExportTool', 'LogicArrangementMarkerTool'],
      model: 'logic-tools'
    };
  }
}
