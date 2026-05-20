export class GameDesignPlanner {
  plan(intent: string): string[] {
    return [
      `Classify as ${intent}.`,
      'Identify target engine and production constraints.',
      'Retrieve engine or project knowledge when available.',
      'Generate implementable design/code plus a test or playtest plan.'
    ];
  }
}
