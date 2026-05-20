import { MusicIntentClassifier, MusicIntent } from './MusicIntentClassifier';

export class MusicWorkflowRouter {
  private classifier = new MusicIntentClassifier();

  route(input: string, mode = 'ask'): { intent: MusicIntent; workflow: string[] } {
    const intent = mode === 'ask' ? this.classifier.classify(input) : this.normalizeMode(mode);
    return {
      intent,
      workflow: this.workflowFor(intent)
    };
  }

  private normalizeMode(mode: string): MusicIntent {
    if (mode === 'fl-studio') return 'fl_studio';
    if (mode === 'pro-tools') return 'pro_tools';
    if (mode === 'daw-translate') return 'daw_translate';
    if (mode === 'arrangement-review') return 'arrangement';
    return (mode.replace(/-/g, '_') as MusicIntent) || 'general';
  }

  private workflowFor(intent: MusicIntent): string[] {
    const base = ['classify request', 'apply copyright guardrails', 'select DAW or music tool', 'return actionable steps'];
    const workflows: Record<MusicIntent, string[]> = {
      suno: ['build prompt', 'add style tags', 'plan structure', 'add avoid list', 'include rights note'],
      fl_studio: ['map to Channel Rack/Piano Roll/Playlist/Mixer', 'give stock-plugin workflow', 'include export/render checks'],
      pro_tools: ['set session format', 'map signal flow', 'cover recording/editing/comping', 'deliver mix-prep or stems'],
      logic: ['set project tempo/key', 'map MIDI/audio workflow', 'use stock Logic tools', 'bounce/export guidance'],
      daw_translate: ['identify source DAW concept', 'map equivalent target DAW concept', 'list workflow differences'],
      mix: ['diagnose likely masking/gain issues', 'fix in order', 'meter/reference check'],
      master: ['prep mix headroom', 'EQ/compression/limiter order', 'loudness and true-peak target'],
      arrangement: ['section map', 'energy curve', 'transitions', 'variation plan'],
      beat: ['tempo/grid', 'drum pattern', '808/bass checks', 'DAW notes'],
      theory: ['key/scale', 'progression', 'voicing', 'melody notes'],
      copyright: ['detect risk', 'rewrite safely', 'rights note'],
      general: base
    };
    return workflows[intent] || base;
  }
}
