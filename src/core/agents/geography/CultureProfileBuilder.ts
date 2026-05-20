import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class CultureProfileBuilder {
  advise(input: string) {
    return createWorkflowGuidance('geography', 'CultureProfileBuilder', input);
  }
}
