import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class SpeechCoach {
  advise(input: string) {
    return createWorkflowGuidance('language', 'SpeechCoach', input);
  }
}
