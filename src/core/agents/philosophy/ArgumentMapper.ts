import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ArgumentMapper {
  advise(input: string) {
    return createWorkflowGuidance('philosophy', 'ArgumentMapper', input);
  }
}
