import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class Translator {
  advise(input: string) {
    return createWorkflowGuidance('language', 'Translator', input);
  }
}
