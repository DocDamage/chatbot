import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ToneRewriter {
  advise(input: string) {
    return createWorkflowGuidance('language', 'ToneRewriter', input);
  }
}
