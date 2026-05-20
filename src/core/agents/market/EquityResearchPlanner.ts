export class EquityResearchPlanner {
  plan(intent: string): string[] {
    return [
      `Classify request as ${intent}.`,
      'Fetch timestamped market, filing, and macro data where configured.',
      'Separate facts from opinions and identify risk factors.',
      'Return bull case, bear case, thesis changers, and a financial-advice disclaimer.'
    ];
  }
}
