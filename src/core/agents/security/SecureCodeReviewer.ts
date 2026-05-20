import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SecureCodeReviewer {
  advise(input: string) {
    return createWorkflowGuidance('security', 'SecureCodeReviewer', input);
  }
}
