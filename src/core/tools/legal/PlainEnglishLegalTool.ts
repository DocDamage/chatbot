export class PlainEnglishLegalTool {
  run(input: Record<string, any> = {}) {
    const concept = String(input.concept || input.query || 'legal concept');
    return {
      domain: 'legal',
      tool: 'PlainEnglishLegalTool',
      concept,
      format: {
        shortVersion: 'Plain-English explanation of the concept, with no claim that it is advice.',
        whatItUsuallyMeans: 'The common practical meaning in everyday terms.',
        whatChangesByJurisdiction: 'Deadlines, definitions, remedies, enforceability, and required forms.',
        whatToCheck: ['exact text', 'jurisdiction', 'dates/deadlines', 'exceptions', 'who is covered', 'remedies'],
        nextQuestion: 'What jurisdiction and exact document/fact pattern are we looking at?'
      },
      disclaimer: 'Legal information only, not legal advice.'
    };
  }
}
