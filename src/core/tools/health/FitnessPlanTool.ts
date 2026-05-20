export interface FitnessPlanInput {
  query?: string;
}

export class FitnessPlanTool {
  run(input: FitnessPlanInput = {}) {
    const query = input.query || '';
    const goal = this.inferGoal(query);
    const experience = /\b(beginner|new|starting|out of shape)\b/i.test(query) ? 'beginner' : 'general';
    const days = Number(query.match(/\b([2-6])\s*(?:day|days|x)\b/i)?.[1]) || (experience === 'beginner' ? 3 : 4);

    return {
      domain: 'health',
      tool: 'FitnessPlanTool',
      goal,
      experience,
      daysPerWeek: days,
      weeklyStructure: this.buildStructure(goal, days),
      progression: [
        'Start with effort around 6-7 out of 10 and leave 1-3 reps in reserve on strength work.',
        'Increase one variable at a time: reps, sets, load, distance, or time.',
        'Deload or reduce volume if pain, sleep disruption, or persistent soreness accumulates.'
      ],
      safety: [
        'Stop for chest pain, fainting, severe shortness of breath, new neurologic symptoms, or sharp joint pain.',
        'Get medical clearance for known heart disease, major injury, pregnancy complications, or symptoms during exertion.'
      ]
    };
  }

  private inferGoal(query: string): string {
    if (/\b(strength|strong|lift|muscle)\b/i.test(query)) return 'strength_and_muscle';
    if (/\b(cardio|endurance|run|conditioning)\b/i.test(query)) return 'cardio_endurance';
    if (/\b(mobility|flexibility|pain|back)\b/i.test(query)) return 'mobility_and_resilience';
    return 'general_fitness';
  }

  private buildStructure(goal: string, days: number): string[] {
    if (goal === 'cardio_endurance') {
      return ['Easy zone-2 cardio', 'Interval or tempo session', 'Strength basics', ...(days > 3 ? ['Long easy session'] : [])];
    }

    if (goal === 'mobility_and_resilience') {
      return ['Mobility and core control', 'Full-body strength', 'Low-impact cardio', ...(days > 3 ? ['Recovery mobility'] : [])];
    }

    return ['Full-body strength A', 'Cardio or conditioning', 'Full-body strength B', ...(days > 3 ? ['Accessory strength and mobility'] : [])];
  }
}
