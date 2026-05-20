export class GenreTropeAnalyzerTool {
  run(input: Record<string, any> = {}) {
    const genre = String(input.genre || 'fantasy');
    return {
      domain: 'story',
      tool: 'GenreTropeAnalyzerTool',
      genre,
      usefulTropes: [
        'A promise the world makes to the audience.',
        'A familiar pattern the reader can orient around.',
        'A pressure system for character choices.'
      ],
      twistMethods: [
        'Change who pays the cost.',
        'Move the trope into a different social class or job.',
        'Invert the expected reward.',
        'Make the trope true, but for a reason nobody expected.'
      ],
      warning: 'A trope is not a problem by itself; unearned execution is the problem.'
    };
  }
}
