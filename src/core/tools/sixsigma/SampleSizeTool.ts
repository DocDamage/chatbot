import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

const Z_SCORES: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };

export class SampleSizeTool implements Tool {
  id = 'calculate_sample_size_mean';
  name = 'calculate_sample_size_mean';
  description = 'Calculate sample size for estimating a process mean.';
  category = ToolCategory.CALCULATION;
  parameters = [
    { name: 'confidence', type: 'number' as const, description: 'Confidence level, usually 90, 95, or 99', required: true },
    { name: 'margin', type: 'number' as const, description: 'Margin of error', required: true },
    { name: 'stdDev', type: 'number' as const, description: 'Estimated standard deviation', required: true }
  ];

  calculateMean(confidence: number, margin: number, stdDev: number) {
    const z = Z_SCORES[confidence] || 1.96;
    const n = Math.ceil(((z * stdDev) ** 2) / (margin ** 2));
    return { n, z, formula: 'n = (Z^2 * sigma^2) / E^2', confidence, margin, stdDev };
  }

  calculateProportion(confidence: number, margin: number, p = 0.5) {
    const z = Z_SCORES[confidence] || 1.96;
    const n = Math.ceil((z ** 2 * p * (1 - p)) / (margin ** 2));
    return { n, z, formula: 'n = Z^2 * p * (1-p) / E^2', confidence, margin, p };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    return { success: true, data: this.calculateMean(params.confidence, params.margin, params.stdDev), metadata: { executionTime: Date.now() - start } };
  }

  createProportionTool(): Tool {
    return {
      id: 'calculate_sample_size_proportion',
      name: 'calculate_sample_size_proportion',
      description: 'Calculate sample size for estimating a proportion.',
      category: ToolCategory.CALCULATION,
      parameters: [
        { name: 'confidence', type: 'number', description: 'Confidence level', required: true },
        { name: 'margin', type: 'number', description: 'Margin of error as a decimal', required: true },
        { name: 'p', type: 'number', description: 'Estimated proportion; defaults to 0.5', required: false }
      ],
      execute: async params => ({ success: true, data: this.calculateProportion(params.confidence, params.margin, params.p ?? 0.5), metadata: { executionTime: 0 } })
    };
  }
}
