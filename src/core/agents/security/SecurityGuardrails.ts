import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SecurityGuardrails {
  advise(input: string) {
    return createWorkflowGuidance('security', 'SecurityGuardrails', input);
  }
}
