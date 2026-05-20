export class SunoRevisionCoach {
  revise(input: string) {
    return {
      component: 'SunoRevisionCoach',
      revisionPrompt: `Revise toward: ${input}. Keep the strongest hook, increase section contrast, clarify vocal direction, and avoid artist imitation.`,
      checklist: ['name what to keep', 'name what to change', 'tighten genre/mood tags', 'add negative prompt items']
    };
  }
}
