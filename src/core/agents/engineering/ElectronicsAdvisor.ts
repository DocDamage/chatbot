import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ElectronicsAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('engineering', 'ElectronicsAdvisor', input);
  }
}
