import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export interface CpkInput {
  mean: number;
  usl: number;
  lsl: number;
  stdDev: number;
}

export class CpkCalculatorTool implements Tool {
  id = 'calculate_cpk';
  name = 'calculate_cpk';
  description = 'Calculate Six Sigma process capability metrics Cp, Cpk, Cpu, Cpl, DPMO, yield, and interpretation.';
  category = ToolCategory.CALCULATION;
  parameters = [
    { name: 'mean', type: 'number' as const, description: 'Process mean', required: true },
    { name: 'usl', type: 'number' as const, description: 'Upper specification limit', required: true },
    { name: 'lsl', type: 'number' as const, description: 'Lower specification limit', required: true },
    { name: 'stdDev', type: 'number' as const, description: 'Process standard deviation', required: true }
  ];

  calculate(input: CpkInput) {
    if (input.stdDev <= 0) throw new Error('stdDev must be greater than zero');
    const cpu = (input.usl - input.mean) / (3 * input.stdDev);
    const cpl = (input.mean - input.lsl) / (3 * input.stdDev);
    const cpk = Math.min(cpu, cpl);
    const cp = (input.usl - input.lsl) / (6 * input.stdDev);
    const dpmo = Math.round(1000000 * (1 - normalCdf(3 * cpk)));
    const yieldPercent = (1 - dpmo / 1000000) * 100;
    return {
      cp,
      cpu,
      cpl,
      cpk,
      dpmo,
      yieldPercent,
      sigmaLevel: 3 * cpk,
      formula: 'Cp = (USL - LSL) / 6σ; Cpu = (USL - mean) / 3σ; Cpl = (mean - LSL) / 3σ; Cpk = min(Cpu, Cpl)',
      interpretation: cpk >= 1.67 ? 'Highly capable' : cpk >= 1.33 ? 'Capable' : cpk >= 1 ? 'Marginally capable' : 'Not capable'
    };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();
    try {
      return { success: true, data: this.calculate(params as CpkInput), metadata: { executionTime: Date.now() - start } };
    } catch (error: any) {
      return { success: false, error: error.message, metadata: { executionTime: Date.now() - start } };
    }
  }
}

function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const scaled = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * scaled);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-scaled * scaled);
  return 0.5 * (1 + sign * y);
}
