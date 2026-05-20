import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class PhilosophyTimelineTool {
  advise(input: string) {
    return createWorkflowGuidance('philosophy', 'PhilosophyTimelineTool', input);
  }
}
