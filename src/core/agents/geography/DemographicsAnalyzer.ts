import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class DemographicsAnalyzer {
  advise(input: string) {
    return createWorkflowGuidance('geography', 'DemographicsAnalyzer', input);
  }
}
