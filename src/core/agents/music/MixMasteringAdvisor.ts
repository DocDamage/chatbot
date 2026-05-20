import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MixMasteringAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('music', 'MixMasteringAdvisor', input);
  }
}
