import { SpacedRepetitionService } from '../../learning/SpacedRepetitionService';

export class SixSigmaLearningCoach {
  private spacedRepetition = new SpacedRepetitionService();

  studyPlan(goal: string) {
    return {
      answerType: 'study_plan',
      beltLevel: this.assessBeltLevel(goal),
      plan: ['DMAIC fundamentals', 'Process capability', 'MSA/Gage R&R', 'Hypothesis testing', 'Control charts', 'Mock exam review'],
      reviewSchedule: this.spacedRepetition.review({ easeFactor: 2.5, repetitions: 0, intervalDays: 0 }, 4).nextReview,
      weakTopicStrategy: 'Quiz weak topics daily, then expand intervals with SM-2 spaced repetition.'
    };
  }

  certification(goal: string) {
    return {
      answerType: 'certification_coaching',
      goal,
      recommendedNextLessons: ['DMAIC project charter', 'Capability analysis', 'ANOVA/regression', 'Control phase artifacts'],
      quizPrompt: 'Explain the difference between Cp and Cpk and when each is useful.'
    };
  }

  private assessBeltLevel(goal: string) {
    const text = goal.toLowerCase();
    if (text.includes('master')) return 'Master Black';
    if (text.includes('black') || text.includes('cssbb')) return 'Black';
    if (text.includes('green')) return 'Green';
    if (text.includes('yellow')) return 'Yellow';
    return 'White';
  }
}
