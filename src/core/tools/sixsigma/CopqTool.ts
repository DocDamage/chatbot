import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class CopqTool implements Tool {
  id = 'calculate_copq';
  name = 'calculate_copq';
  description = 'Calculate Cost of Poor Quality from appraisal and failure costs.';
  category = ToolCategory.CALCULATION;
  parameters = [
    { name: 'appraisalCosts', type: 'number' as const, description: 'Appraisal costs', required: true },
    { name: 'internalFailureCosts', type: 'number' as const, description: 'Internal failure costs', required: true },
    { name: 'externalFailureCosts', type: 'number' as const, description: 'External failure costs', required: true },
    { name: 'preventionCosts', type: 'number' as const, description: 'Prevention costs', required: true },
    { name: 'totalSales', type: 'number' as const, description: 'Total sales', required: true }
  ];

  calculate(params: Record<string, number>) {
    const totalCopq = params.appraisalCosts + params.internalFailureCosts + params.externalFailureCosts;
    const totalQualityCosts = totalCopq + params.preventionCosts;
    const copqPercent = (totalCopq / params.totalSales) * 100;
    return { totalCopq, totalQualityCosts, copqPercent, benchmark: copqPercent < 10 ? 'World class' : copqPercent < 15 ? 'Industry average' : copqPercent < 25 ? 'Improvement needed' : 'Urgent action required' };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.calculate(params), metadata: { executionTime: 0 } };
  }
}
