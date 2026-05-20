export class MixChecklistTool {
  run(input: Record<string, any> = {}) {
    const issue = String(input.issue || '').toLowerCase();
    const muddy = issue.includes('mud') || issue.includes('low mid') || issue.includes('cloud');
    return {
      domain: 'music',
      tool: 'MixChecklistTool',
      focus: muddy ? 'muddy mix / low-mid buildup' : 'general mix balance',
      checks: muddy ? [
        'High-pass non-bass elements until the low end clears, usually somewhere between 60-150 Hz depending on the source.',
        'Sweep 180-450 Hz on pads, guitars, keys, vocals, and reverbs for boxiness.',
        'Pick one true low-end owner: kick fundamental, bass/808 fundamental, or sub layer.',
        'Shorten reverb tails or high-pass reverb returns so ambience does not fill the low mids.',
        'Use arrangement muting before EQ: too many sustained midrange parts will stay muddy even after processing.'
      ] : [
        'Set rough static faders before plugins.',
        'Check kick, bass, vocal/lead, and snare relationship in mono.',
        'Use subtractive EQ before compression when masking is obvious.',
        'Reference at matched loudness, not louder-is-better.',
        'Leave headroom before limiting.'
      ],
      quickFix: muddy
        ? 'Mute half the midrange layers, then bring them back one at a time. The first layer that makes the groove cloudy is the one to EQ, shorten, pan, or rewrite.'
        : 'Do a static balance pass, then fix only the elements that still compete.'
    };
  }
}
