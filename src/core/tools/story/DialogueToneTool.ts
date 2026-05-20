export class DialogueToneTool {
  run(input: Record<string, any> = {}) {
    const tone = String(input.tone || 'tense');
    return {
      domain: 'story',
      tool: 'DialogueToneTool',
      tone,
      rewriteRules: [
        'Give each speaker a different tactic: deflect, press, charm, threaten, bargain, confess.',
        'Put subtext under the literal line; characters rarely say the whole truth cleanly.',
        'Cut greetings and throat-clearing unless the awkwardness is the point.',
        'Let status shift during the scene through interruptions, silence, or changed sentence length.',
        'End the exchange on a changed decision, not just a clever line.'
      ],
      lineStarters: tone.includes('funny')
        ? ['That is a heroic amount of being wrong.', 'I respect the confidence. Hate the plan.', 'Say that again, but less doomed.']
        : ['You knew before you walked in.', 'Do not make me ask twice.', 'If I say yes, somebody pays for it.']
    };
  }
}
