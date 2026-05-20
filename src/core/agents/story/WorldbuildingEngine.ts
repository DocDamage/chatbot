import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class WorldbuildingEngine {
  advise(input: string) {
    return createWorkflowGuidance('story', 'WorldbuildingEngine', input);
  }
}
