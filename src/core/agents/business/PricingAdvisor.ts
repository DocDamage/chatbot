import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class PricingAdvisor {
  advise(input: string) {
    return createWorkflowGuidance('business', 'PricingAdvisor', input);
  }
}
