import { createWorkflowGuidance } from '../specialists/WorkflowComponent';

export class ProductStrategist {
  advise(input: string) {
    return createWorkflowGuidance('business', 'ProductStrategist', input);
  }
}
