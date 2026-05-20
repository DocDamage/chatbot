import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class FallacyDetector {
  advise(input: string) {
    return createWorkflowGuidance('philosophy', 'FallacyDetector', input);
  }
}
