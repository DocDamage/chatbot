import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SafetyChecklist {
  advise(input: string) {
    return createWorkflowGuidance('engineering', 'SafetyChecklist', input);
  }
}
