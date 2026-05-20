import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class AnatomyTutor {
  advise(input: string) {
    return createWorkflowGuidance('health', 'AnatomyTutor', input);
  }
}
