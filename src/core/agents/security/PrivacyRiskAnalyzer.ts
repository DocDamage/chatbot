import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class PrivacyRiskAnalyzer {
  advise(input: string) {
    return createWorkflowGuidance('security', 'PrivacyRiskAnalyzer', input);
  }
}
