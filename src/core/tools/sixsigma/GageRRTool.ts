import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class GageRRTool implements Tool {
  id = 'calculate_gage_rr';
  name = 'calculate_gage_rr';
  description = 'Calculate basic Gage R&R percent study variation and NDC.';
  category = ToolCategory.CALCULATION;
  parameters = [
    { name: 'partVariation', type: 'number' as const, description: 'Part-to-part variation', required: true },
    { name: 'appraiserVariation', type: 'number' as const, description: 'Reproducibility/appraiser variation', required: true },
    { name: 'equipmentVariation', type: 'number' as const, description: 'Repeatability/equipment variation', required: true }
  ];

  calculate(partVariation: number, appraiserVariation: number, equipmentVariation: number) {
    const grr = Math.sqrt(appraiserVariation ** 2 + equipmentVariation ** 2);
    const totalVariation = Math.sqrt(grr ** 2 + partVariation ** 2);
    const percentStudyVar = (grr / totalVariation) * 100;
    const ndc = Math.floor(1.41 * (partVariation / grr));
    return { grr, totalVariation, percentStudyVar, ndc, interpretation: percentStudyVar < 10 ? 'Acceptable' : percentStudyVar < 30 ? 'Conditional' : 'Unacceptable' };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.calculate(params.partVariation, params.appraiserVariation, params.equipmentVariation), metadata: { executionTime: 0 } };
  }
}
