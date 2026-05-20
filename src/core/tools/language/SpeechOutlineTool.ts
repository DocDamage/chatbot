export interface SpeechOutlineInput {
  query?: string;
}

export class SpeechOutlineTool {
  run(input: SpeechOutlineInput = {}) {
    const query = input.query || '';
    const minutes = Number(query.match(/\b(\d{1,2})\s*(?:minute|min)\b/i)?.[1]) || 3;
    const topic = query.replace(/\b(write|make|outline|speech|presentation|talk|\d{1,2}\s*(?:minute|min))\b/gi, '').trim() || 'the topic';

    return {
      domain: 'language',
      tool: 'SpeechOutlineTool',
      topic,
      minutes,
      structure: [
        { section: 'Hook', timeSeconds: Math.round(minutes * 60 * 0.15), goal: 'Earn attention with a concrete image, question, or stakes.' },
        { section: 'Thesis', timeSeconds: Math.round(minutes * 60 * 0.1), goal: 'State the main point in one sentence.' },
        { section: 'Three points', timeSeconds: Math.round(minutes * 60 * 0.55), goal: 'Use one example or piece of evidence per point.' },
        { section: 'Close', timeSeconds: Math.round(minutes * 60 * 0.2), goal: 'Return to the hook and give the audience a clear takeaway.' }
      ],
      deliveryTips: [
        'Write for the ear, not the page.',
        'Use shorter sentences than an essay.',
        'Mark pauses after important lines.'
      ]
    };
  }
}
