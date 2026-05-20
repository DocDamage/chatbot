import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SampleWorkflowAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('music', 'SampleWorkflowAdvisor', input);
  }
}
