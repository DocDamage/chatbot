export interface SocraticQuestionInput {
  query?: string;
}

export class SocraticQuestionTool {
  run(input: SocraticQuestionInput = {}) {
    const query = input.query || '';

    return {
      domain: 'philosophy',
      tool: 'SocraticQuestionTool',
      focus: query,
      questions: [
        'What exactly do you mean by the key term?',
        'What example best supports the claim?',
        'What counterexample would make the claim weaker?',
        'What assumption does the argument need but does not state?',
        'Would you accept the same reasoning if an opponent used it?'
      ],
      teachingMove: 'Use these questions to clarify, not to trap. The goal is sharper thinking.'
    };
  }
}
