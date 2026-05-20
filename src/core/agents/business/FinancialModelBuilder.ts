import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class FinancialModelBuilder {
  advise(input: string) {
    return createWorkflowGuidance('business', 'FinancialModelBuilder', input);
  }
}
