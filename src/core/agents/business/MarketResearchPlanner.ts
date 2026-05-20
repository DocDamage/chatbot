import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class MarketResearchPlanner {
  advise(input: string) {
    return createWorkflowGuidance('business', 'MarketResearchPlanner', input);
  }
}
