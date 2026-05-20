import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class RightsAndObligationsAnalyzer {
  advise(input: string) {
    return createWorkflowGuidance('legal', 'RightsAndObligationsAnalyzer', input);
  }
}
