import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class LegalGuardrails {
  advise(input: string) {
    return createWorkflowGuidance('legal', 'LegalGuardrails', input);
  }
}
