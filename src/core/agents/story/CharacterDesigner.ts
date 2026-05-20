import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class CharacterDesigner {
  advise(input: string) {
    return createWorkflowGuidance('story', 'CharacterDesigner', input);
  }
}
