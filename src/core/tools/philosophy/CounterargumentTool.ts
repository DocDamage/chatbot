export interface CounterargumentInput {
  query?: string;
}

export class CounterargumentTool {
  run(input: CounterargumentInput = {}) {
    const query = input.query || '';

    return {
      domain: 'philosophy',
      tool: 'CounterargumentTool',
      originalPosition: query,
      steelman: 'State the opposing view in a form its supporters would recognize as fair and strong.',
      counterMoves: [
        'Challenge a premise with evidence or a counterexample.',
        'Accept the premise but deny that the conclusion follows.',
        'Show a tradeoff the original argument underweights.',
        'Clarify a key term that is doing too much work.'
      ],
      fairReplyTemplate: [
        'I agree with the concern that...',
        'The strongest reason against it is...',
        'My disagreement is narrower:...',
        'The evidence that would change my mind is...'
      ]
    };
  }
}
