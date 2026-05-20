import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class BeatArrangementCoach {
  advise(input: string) {
    return createWorkflowGuidance('music', 'BeatArrangementCoach', input);
  }
}
