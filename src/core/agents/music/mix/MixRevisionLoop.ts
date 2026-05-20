export class MixRevisionLoop {
  revise(input: Record<string, any>, previousPlan: any) {
    return {
      revisionGoal: input.revision || input.query || 'tighten the mix pass',
      keep: previousPlan?.moves?.map((move: any) => move.id).slice(0, 3) || ['gain-stage', 'low-end-pocket'],
      change: [
        'Make smaller moves than the first pass.',
        'Re-check low end and vocal level after every render.',
        'Stop if the mix starts losing punch or clarity.'
      ],
      nextApproval: 'Ask before applying master or plugin-parameter changes.'
    };
  }
}
