import { Tool, ToolCategory, ToolResult } from '../../../types/tools';
import { ArrangementMapTool } from './ArrangementMapTool';
import { BpmTool } from './BpmTool';
import { DawWorkflowMapTool } from './DawWorkflowMapTool';
import { DrumPatternTool } from './DrumPatternTool';
import { FLAutomationTool } from './FLAutomationTool';
import { FLExportSettingsTool } from './FLExportSettingsTool';
import { FLMixerRoutingTool } from './FLMixerRoutingTool';
import { FLPianoRollTool } from './FLPianoRollTool';
import { FLPluginChainTool } from './FLPluginChainTool';
import { FLStepSequencerPatternTool } from './FLStepSequencerPatternTool';
import { KeyScaleTool } from './KeyScaleTool';
import { LogicBounceExportTool } from './LogicBounceExportTool';
import { LogicMidiWorkflowTool } from './LogicMidiWorkflowTool';
import { LogicProjectSetupTool } from './LogicProjectSetupTool';
import { LogicVocalChainTool } from './LogicVocalChainTool';
import { LoudnessTargetTool } from './LoudnessTargetTool';
import { MasteringChecklistTool } from './MasteringChecklistTool';
import { MixDiagnosticTool } from './MixDiagnosticTool';
import { ProToolsExportStemTool } from './ProToolsExportStemTool';
import { ProToolsSessionSetupTool } from './ProToolsSessionSetupTool';
import { ProToolsSignalFlowTool } from './ProToolsSignalFlowTool';
import { ProToolsVocalCompTool } from './ProToolsVocalCompTool';
import { SunoHookTool } from './SunoHookTool';
import { SunoPromptTool } from './SunoPromptTool';
import { SunoRevisionTool } from './SunoRevisionTool';
import { SunoRightsGuardrailTool } from './SunoRightsGuardrailTool';
import { SunoStructureTool } from './SunoStructureTool';
import { SunoStyleBlendTool } from './SunoStyleBlendTool';
import { VocalChainTool } from './VocalChainTool';

interface MusicToolSpec {
  id: string;
  name: string;
  description: string;
  runner: { run(input?: Record<string, any>): Record<string, any> };
}

function wrapMusicTool(spec: MusicToolSpec): Tool {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: ToolCategory.CALCULATION,
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'The music production request or workflow question.',
        required: true
      },
      {
        name: 'context',
        type: 'object',
        description: 'Optional structured music context such as DAW, genre, key, BPM, tracks, or problem.',
        required: false
      }
    ],
    execute: async (params: Record<string, any>): Promise<ToolResult> => {
      const started = Date.now();
      try {
        const data = spec.runner.run({
          ...(params.context || {}),
          query: params.query
        });
        return {
          success: true,
          data,
          metadata: { executionTime: Date.now() - started }
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message || String(error),
          metadata: { executionTime: Date.now() - started }
        };
      }
    }
  };
}

export function createMusicTools(): Tool[] {
  const specs: MusicToolSpec[] = [
    { id: 'music_bpm', name: 'music_bpm', description: 'Detect or interpret BPM text for music workflows.', runner: new BpmTool() },
    { id: 'music_key_scale', name: 'music_key_scale', description: 'Explain key, scale degrees, and tuning checks.', runner: new KeyScaleTool() },
    { id: 'music_drum_pattern', name: 'music_drum_pattern', description: 'Generate genre-aware drum pattern guidance.', runner: new DrumPatternTool() },
    { id: 'music_arrangement_map', name: 'music_arrangement_map', description: 'Build a section map and energy curve for a song.', runner: new ArrangementMapTool() },
    { id: 'music_mix_diagnostic', name: 'music_mix_diagnostic', description: 'Diagnose common mix issues like muddy low end and masking.', runner: new MixDiagnosticTool() },
    { id: 'music_mastering_checklist', name: 'music_mastering_checklist', description: 'Return mastering prep, chain, and metering checks.', runner: new MasteringChecklistTool() },
    { id: 'music_loudness_target', name: 'music_loudness_target', description: 'Suggest loudness and true-peak targets with caveats.', runner: new LoudnessTargetTool() },
    { id: 'music_vocal_chain', name: 'music_vocal_chain', description: 'Suggest stock/generic vocal chain guidance.', runner: new VocalChainTool() },
    { id: 'music_daw_workflow_map', name: 'music_daw_workflow_map', description: 'Translate workflow concepts across DAWs.', runner: new DawWorkflowMapTool() },
    { id: 'suno_prompt', name: 'suno_prompt', description: 'Build safe Suno prompts with genre, mood, vocal, and avoid guidance.', runner: new SunoPromptTool() },
    { id: 'suno_style_blend', name: 'suno_style_blend', description: 'Create safe Suno style blends without artist cloning.', runner: new SunoStyleBlendTool() },
    { id: 'suno_structure', name: 'suno_structure', description: 'Plan Suno section tags and arrangement structure.', runner: new SunoStructureTool() },
    { id: 'suno_hook', name: 'suno_hook', description: 'Suggest original hook direction without copyrighted lyrics.', runner: new SunoHookTool() },
    { id: 'suno_revision', name: 'suno_revision', description: 'Create Suno revision prompts that name what to keep/change/avoid.', runner: new SunoRevisionTool() },
    { id: 'suno_rights_guardrail', name: 'suno_rights_guardrail', description: 'Return Suno copyright, artist-cloning, and ownership guardrails.', runner: new SunoRightsGuardrailTool() },
    { id: 'fl_step_sequencer_pattern', name: 'fl_step_sequencer_pattern', description: 'Create FL Studio Channel Rack and pattern guidance.', runner: new FLStepSequencerPatternTool() },
    { id: 'fl_piano_roll', name: 'fl_piano_roll', description: 'Give FL Piano Roll guidance for 808s, hats, notes, and velocity.', runner: new FLPianoRollTool() },
    { id: 'fl_mixer_routing', name: 'fl_mixer_routing', description: 'Explain FL Mixer inserts, buses, sends, and sidechain routing.', runner: new FLMixerRoutingTool() },
    { id: 'fl_automation', name: 'fl_automation', description: 'Plan FL Studio automation clips and targets.', runner: new FLAutomationTool() },
    { id: 'fl_export_settings', name: 'fl_export_settings', description: 'Return FL Studio export and stem checklist.', runner: new FLExportSettingsTool() },
    { id: 'fl_plugin_chain', name: 'fl_plugin_chain', description: 'Suggest stock FL Studio plugin chains.', runner: new FLPluginChainTool() },
    { id: 'protools_session_setup', name: 'protools_session_setup', description: 'Set up Pro Tools sessions for recording or mixing.', runner: new ProToolsSessionSetupTool() },
    { id: 'protools_signal_flow', name: 'protools_signal_flow', description: 'Explain Pro Tools signal flow, inserts, sends, and aux routing.', runner: new ProToolsSignalFlowTool() },
    { id: 'protools_vocal_comp', name: 'protools_vocal_comp', description: 'Guide Pro Tools playlist vocal comping workflow.', runner: new ProToolsVocalCompTool() },
    { id: 'protools_export_stem', name: 'protools_export_stem', description: 'Prepare and export Pro Tools stems.', runner: new ProToolsExportStemTool() },
    { id: 'logic_project_setup', name: 'logic_project_setup', description: 'Set up Logic projects with tempo, key, tracks, and markers.', runner: new LogicProjectSetupTool() },
    { id: 'logic_midi_workflow', name: 'logic_midi_workflow', description: 'Explain Logic MIDI and Piano Roll workflow.', runner: new LogicMidiWorkflowTool() },
    { id: 'logic_vocal_chain', name: 'logic_vocal_chain', description: 'Suggest stock Logic vocal chains.', runner: new LogicVocalChainTool() },
    { id: 'logic_bounce_export', name: 'logic_bounce_export', description: 'Return Logic bounce and export checklist.', runner: new LogicBounceExportTool() }
  ];

  return specs.map(wrapMusicTool);
}
