import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class DialogueCoach {
  advise(input: string) {
    return createWorkflowGuidance('story', 'DialogueCoach', input);
  }
}
