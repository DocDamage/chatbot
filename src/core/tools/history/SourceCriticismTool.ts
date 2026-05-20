export class SourceCriticismTool {
  assess(sourceType: string) {
    return {
      sourceType,
      questions: ['Who created it?', 'When?', 'For what audience?', 'What bias or survival gap exists?', 'Is it primary, secondary, or reference?']
    };
  }
}
