import { FLEdisonWorkflowTool } from '../../../tools/music/FLEdisonWorkflowTool';
import { FLAutomationTool } from '../../../tools/music/FLAutomationTool';
import { FLExportSettingsTool } from '../../../tools/music/FLExportSettingsTool';
import { FLGrossBeatAdvisorTool } from '../../../tools/music/FLGrossBeatAdvisorTool';
import { FLMixerRoutingTool } from '../../../tools/music/FLMixerRoutingTool';
import { FLPianoRollTool } from '../../../tools/music/FLPianoRollTool';
import { FLPluginChainTool } from '../../../tools/music/FLPluginChainTool';
import { FLStepSequencerPatternTool } from '../../../tools/music/FLStepSequencerPatternTool';

export class FLStudioGeniusAgent {
  private stepSequencer = new FLStepSequencerPatternTool();
  private pianoRoll = new FLPianoRollTool();
  private mixerRouting = new FLMixerRoutingTool();
  private automation = new FLAutomationTool();
  private edison = new FLEdisonWorkflowTool();
  private grossBeat = new FLGrossBeatAdvisorTool();
  private exportSettings = new FLExportSettingsTool();
  private pluginChain = new FLPluginChainTool();

  ask(query: string) {
    const text = query.toLowerCase();
    const pattern = this.stepSequencer.run({ query, daw: 'fl_studio' });
    const pianoRoll = this.pianoRoll.run({ query });
    const mixer = this.mixerRouting.run({ query });
    const plugins = this.pluginChain.run({ query });
    const automation = this.automation.run({ query });
    const exportSettings = this.exportSettings.run({ query });
    const extra = text.includes('gross beat') || text.includes('halftime') ? this.grossBeat.run({ query }) : text.includes('edison') || text.includes('record') ? this.edison.run({ query }) : undefined;
    const workflow = this.workflow(text);

    return {
      domain: 'music',
      mode: 'fl_studio',
      response: [
        'FL Studio Genius',
        '',
        `Goal: ${query}`,
        '',
        'FL workflow:',
        ...workflow.map(step => `- ${step}`),
        '',
        'Pattern notes:',
        `- ${JSON.stringify(pattern.pattern)}`,
        '',
        'Piano Roll:',
        ...pianoRoll.steps.map(step => `- ${step}`),
        '',
        'Mixer routing:',
        ...mixer.routing.map(step => `- ${step}`),
        '',
        'Stock plugin chain:',
        `- ${plugins.chain.join(' -> ')}`,
        '',
        'Automation/export:',
        `- ${automation.automationTargets.join(', ')}`,
        `- ${exportSettings.checklist.join('; ')}`,
        ...(extra ? ['', `${extra.tool}:`, `- ${JSON.stringify(extra)}`] : []),
        '',
        'Common mistakes:',
        '- Leaving 808 root note/tuning unchecked.',
        '- Building everything in one mixer insert.',
        '- Exporting without checking clipping, tail length, and split mixer tracks.'
      ].join('\n'),
      sources: ['knowledge-base-public/music/flstudio'],
      guardrails: ['Use official manual/support docs for version-specific steps.', 'Avoid artist cloning and copyrighted lyrics.'],
      tools: ['FLStepSequencerPatternTool', 'FLPianoRollTool', 'FLMixerRoutingTool', 'FLAutomationTool', 'FLEdisonWorkflowTool', 'FLGrossBeatAdvisorTool', 'FLExportSettingsTool', 'FLPluginChainTool'],
      model: 'fl-studio-tools'
    };
  }

  private workflow(text: string): string[] {
    if (text.includes('808') || text.includes('off-key')) {
      return ['Open sampler settings and confirm root note.', 'Tune the 808 sample, then play bass notes in Piano Roll.', 'Check slide notes, envelopes, mono behavior, and mixer distortion.'];
    }
    if (text.includes('sidechain')) {
      return ['Route kick and 808/bass to mixer inserts.', 'Use Fruity Limiter compressor sidechain or volume automation.', 'Set release to groove with the beat, not pump randomly.'];
    }
    return ['Sketch in Channel Rack.', 'Edit velocity/rolls in Piano Roll.', 'Arrange patterns in Playlist.', 'Route sounds to Mixer inserts.', 'Render full mix and stems when needed.'];
  }
}
