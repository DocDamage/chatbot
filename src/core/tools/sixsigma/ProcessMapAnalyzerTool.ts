import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export interface ProcessStep {
  name: string;
  cycleTime: number;
  waitTime?: number;
  valueAdded?: boolean;
}

export class ProcessMapAnalyzerTool implements Tool {
  id = 'analyze_process_map';
  name = 'analyze_process_map';
  description = 'Analyze process-map cycle time, wait time, value-added percent, bottleneck, and waste categories.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'steps', type: 'array' as const, description: 'Process steps', required: true }];

  analyze(steps: ProcessStep[]) {
    const cycleTime = steps.reduce((sum, step) => sum + step.cycleTime, 0);
    const waitTime = steps.reduce((sum, step) => sum + (step.waitTime || 0), 0);
    const valueAddedTime = steps.filter(step => step.valueAdded).reduce((sum, step) => sum + step.cycleTime, 0);
    const bottleneck = [...steps].sort((a, b) => b.cycleTime - a.cycleTime)[0];
    return {
      steps,
      cycleTime,
      waitTime,
      valueAddedPercent: cycleTime > 0 ? (valueAddedTime / cycleTime) * 100 : 0,
      bottleneck,
      wasteCategories: ['waiting', 'motion', 'rework', 'overprocessing'].filter((_, index) => index < Math.max(1, steps.filter(step => !step.valueAdded).length)),
      improvementSuggestions: ['Reduce queue time at the bottleneck.', 'Move inspection upstream.', 'Standardize handoffs and mistake-proof rework loops.']
    };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.analyze(params.steps || []), metadata: { executionTime: 0 } };
  }
}
