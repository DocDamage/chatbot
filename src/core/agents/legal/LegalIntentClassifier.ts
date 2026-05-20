import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class LegalIntentClassifier {
  advise(input: string) {
    return createWorkflowGuidance('legal', 'LegalIntentClassifier', input);
  }
}
