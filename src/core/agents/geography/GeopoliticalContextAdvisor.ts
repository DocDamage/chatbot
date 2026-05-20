import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class GeopoliticalContextAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('geography', 'GeopoliticalContextAdvisor', input);
  }
}
