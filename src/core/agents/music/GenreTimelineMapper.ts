import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class GenreTimelineMapper {
  advise(input: string) {
    return createWorkflowGuidance('music', 'GenreTimelineMapper', input);
  }
}
