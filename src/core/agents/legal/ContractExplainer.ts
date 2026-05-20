import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ContractExplainer {
  advise(input: string) {
    return createWorkflowGuidance('legal', 'ContractExplainer', input);
  }
}
