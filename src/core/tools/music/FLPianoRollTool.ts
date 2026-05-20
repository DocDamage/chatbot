export class FLPianoRollTool {
  run(input: Record<string, any> = {}) {
    const query = String(input.query || '');
    return {
      domain: 'music',
      tool: 'FLPianoRollTool',
      focus: /808|bass/i.test(query) ? '808 tuning and slides' : /hat|roll/i.test(query) ? 'hi-hat rolls and velocity' : 'melody and MIDI editing',
      steps: [
        'Confirm the sample root note and project scale/key.',
        'Use Piano Roll note placement for rhythm and pitch, not only Channel Rack steps.',
        'Adjust velocity, note length, slides, and timing for feel.',
        'Check ghost notes or scale highlighting to avoid off-key notes.'
      ],
      commonMistakes: ['wrong sample root note', 'all notes same velocity', 'slides overlapping unintentionally']
    };
  }
}
