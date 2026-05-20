import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class SigmaDpmoTool implements Tool {
  id = 'convert_sigma_to_dpmo';
  name = 'convert_sigma_to_dpmo';
  description = 'Convert sigma level to DPMO using the common 1.5 sigma shift convention.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'sigma', type: 'number' as const, description: 'Sigma level', required: true }];

  calculate(sigma: number) {
    const dpmo = Math.round(1000000 * (1 - normalCdf(sigma - 1.5)));
    return { sigma, dpmo, yieldPercent: (1 - dpmo / 1000000) * 100, convention: '1.5 sigma shift' };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.calculate(params.sigma), metadata: { executionTime: 0 } };
  }
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return sign * y;
}
