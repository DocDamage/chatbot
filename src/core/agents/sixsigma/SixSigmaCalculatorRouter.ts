import { CpkCalculatorTool } from '../../tools/sixsigma/CpkCalculatorTool';
import { SampleSizeTool } from '../../tools/sixsigma/SampleSizeTool';
import { GageRRTool } from '../../tools/sixsigma/GageRRTool';
import { SigmaDpmoTool } from '../../tools/sixsigma/SigmaDpmoTool';
import { CopqTool } from '../../tools/sixsigma/CopqTool';
import { AnovaTool } from '../../tools/sixsigma/AnovaTool';
import { RegressionTool } from '../../tools/sixsigma/RegressionTool';
import { ControlChartConstantsTool } from '../../tools/sixsigma/ControlChartConstantsTool';

export class SixSigmaCalculatorRouter {
  readonly cpk = new CpkCalculatorTool();
  readonly sampleSize = new SampleSizeTool();
  readonly gageRR = new GageRRTool();
  readonly sigmaDpmo = new SigmaDpmoTool();
  readonly copq = new CopqTool();
  readonly anova = new AnovaTool();
  readonly regression = new RegressionTool();
  readonly constants = new ControlChartConstantsTool();

  calculate(input: string) {
    if (input.toLowerCase().includes('cpk')) {
      const values = this.extractCpkInputs(input);
      return { tool: 'calculate_cpk', result: this.cpk.calculate(values) };
    }
    return { tool: 'calculator_router', result: { note: 'Calculator identified; provide complete numeric inputs to run it.' } };
  }

  private extractCpkInputs(input: string) {
    const mean = this.extract(input, /\bmean\s*(?:is|=)?\s*(-?\d+(?:\.\d+)?)/i, 10);
    const usl = this.extract(input, /\bUSL\s*(?:is|=)?\s*(-?\d+(?:\.\d+)?)/i, 10.5);
    const lsl = this.extract(input, /\bLSL\s*(?:is|=)?\s*(-?\d+(?:\.\d+)?)/i, 9.5);
    const stdDev = this.extract(input, /\b(?:std dev|standard deviation|sigma)\s*(?:is|=)?\s*(-?\d*\.?\d+)/i, 0.1);
    return { mean, usl, lsl, stdDev };
  }

  private extract(input: string, pattern: RegExp, fallback: number): number {
    return Number(input.match(pattern)?.[1] ?? fallback);
  }
}
