import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class DebateCoach {
  advise(input: string) {
    return createWorkflowGuidance('philosophy', 'DebateCoach', input);
  }
}
