export class ContinuityCheckerTool {
  run(input: Record<string, any> = {}) {
    const facts = Array.isArray(input.facts) ? input.facts : [];
    const scene = String(input.scene || input.query || '');
    const issues = facts
      .filter((fact: string) => fact && scene && !scene.toLowerCase().includes(String(fact).toLowerCase().slice(0, 24)))
      .map((fact: string) => `Scene does not visibly account for locked fact: ${fact}`);

    return {
      domain: 'story',
      tool: 'ContinuityCheckerTool',
      lockedFactsChecked: facts.length,
      issues,
      checklist: [
        'Timeline: does this happen before/after all referenced events?',
        'Knowledge: does each character only know what they have learned?',
        'Rules: does magic/tech/politics obey prior limits?',
        'Motivation: did anyone change goals without a visible cause?',
        'Consequences: did previous injuries, debts, betrayals, or promises matter?'
      ],
      status: issues.length === 0 ? 'no deterministic contradictions found' : 'review needed'
    };
  }
}
