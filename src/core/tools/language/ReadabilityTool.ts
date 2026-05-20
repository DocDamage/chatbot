export interface ReadabilityInput {
  query?: string;
  text?: string;
}

export class ReadabilityTool {
  run(input: ReadabilityInput = {}) {
    const text = input.text || input.query || '';
    const words = text.trim().split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).map(item => item.trim()).filter(Boolean);
    const longWords = words.filter(word => word.replace(/[^a-z]/gi, '').length >= 12);
    const avgSentenceLength = sentences.length > 0 ? Math.round(words.length / sentences.length) : words.length;

    return {
      domain: 'language',
      tool: 'ReadabilityTool',
      metrics: {
        words: words.length,
        sentences: sentences.length,
        averageSentenceLength: avgSentenceLength,
        longWordCount: longWords.length
      },
      level: avgSentenceLength > 24 || longWords.length > 6 ? 'dense' : avgSentenceLength > 16 ? 'moderate' : 'easy',
      suggestions: [
        avgSentenceLength > 20 ? 'Break long sentences into smaller steps.' : 'Sentence length is manageable.',
        longWords.length > 3 ? 'Replace or define technical terms.' : 'Vocabulary load is manageable.',
        'Put the main point in the first sentence.',
        'Use bullets for procedures, requirements, or multiple examples.'
      ]
    };
  }
}
