import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class CadDesignCoach {
  advise(input: string) {
    return createWorkflowGuidance('engineering', 'CadDesignCoach', input);
  }
}
