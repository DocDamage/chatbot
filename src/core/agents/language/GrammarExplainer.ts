import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class GrammarExplainer {
  advise(input: string) {
    return createWorkflowGuidance('language', 'GrammarExplainer', input);
  }
}
