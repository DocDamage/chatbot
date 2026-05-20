export class LoreBibleTool {
  run(input: Record<string, any> = {}) {
    const setting = String(input.setting || input.query || 'a contested world');
    return {
      domain: 'story',
      tool: 'LoreBibleTool',
      setting,
      sections: [
        'Core premise: one paragraph that defines the world conflict.',
        'Rules: what is physically, socially, magically, or technologically true.',
        'Factions: goals, resources, taboos, symbols, and internal disagreement.',
        'Places: function, mood, danger, economy, and what changed there.',
        'Timeline: 5-8 events that explain present tensions.',
        'Glossary: names, terms, slang, currencies, rituals, and forbidden words.',
        'Continuity locks: facts that future scenes cannot contradict.'
      ],
      starter: {
        centralTension: 'Who controls the resource, secret, route, throne, machine, or myth everyone needs?',
        dailyLife: 'Show what ordinary people eat, fear, celebrate, trade, and lie about.',
        productionTip: 'Write lore as usable scene fuel, not encyclopedia filler.'
      }
    };
  }
}
