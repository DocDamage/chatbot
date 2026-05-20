import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class RhetoricCoach {
  advise(input: string) {
    return createWorkflowGuidance('language', 'RhetoricCoach', input);
  }
}
