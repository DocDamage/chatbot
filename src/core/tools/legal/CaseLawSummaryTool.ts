export class CaseLawSummaryTool {
  run(input: Record<string, any> = {}) {
    const caseName = String(input.caseName || input.query || 'case');
    return {
      domain: 'legal',
      tool: 'CaseLawSummaryTool',
      caseName,
      summaryTemplate: {
        courtAndDate: 'Which court decided it and when?',
        posture: 'What stage was the case in?',
        facts: 'Only legally relevant facts.',
        issue: 'The legal question the court answered.',
        holding: 'The rule/outcome.',
        reasoning: 'Why the court reached that result.',
        limits: 'What the case does not decide.'
      },
      caution: 'Case law changes by jurisdiction and later treatment; verify citator/status before relying on it.'
    };
  }
}
