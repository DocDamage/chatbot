import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class NutritionCoach {
  advise(input: string) {
    return createWorkflowGuidance('health', 'NutritionCoach', input);
  }
}
