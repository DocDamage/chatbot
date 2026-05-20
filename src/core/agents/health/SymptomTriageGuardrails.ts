import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SymptomTriageGuardrails {
  advise(input: string) {
    return createWorkflowGuidance('health', 'SymptomTriageGuardrails', input);
  }
}
