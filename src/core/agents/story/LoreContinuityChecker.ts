import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class LoreContinuityChecker {
  advise(input: string) {
    return createWorkflowGuidance('story', 'LoreContinuityChecker', input);
  }
}
