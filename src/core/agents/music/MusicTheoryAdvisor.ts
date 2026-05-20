import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MusicTheoryAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('music', 'MusicTheoryAdvisor', input);
  }
}
