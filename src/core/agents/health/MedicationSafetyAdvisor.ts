import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MedicationSafetyAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('health', 'MedicationSafetyAdvisor', input);
  }
}
