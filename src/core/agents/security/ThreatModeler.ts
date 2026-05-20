import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ThreatModeler {
  advise(input: string) {
    return createWorkflowGuidance('security', 'ThreatModeler', input);
  }
}
