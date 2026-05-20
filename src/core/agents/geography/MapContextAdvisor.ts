import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MapContextAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('geography', 'MapContextAdvisor', input);
  }
}
