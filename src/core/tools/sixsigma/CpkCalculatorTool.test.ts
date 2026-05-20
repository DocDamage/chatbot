import { CpkCalculatorTool } from './CpkCalculatorTool';

describe('CpkCalculatorTool', () => {
  it('calculates Cp, Cpu, Cpl, and Cpk deterministically', () => {
    const tool = new CpkCalculatorTool();

    const result = tool.calculate({ mean: 10, usl: 10.5, lsl: 9.5, stdDev: 0.1 });

    expect(result.cpk).toBeCloseTo(1.666, 2);
    expect(result.cp).toBeCloseTo(1.666, 2);
    expect(result.cpu).toBeCloseTo(1.666, 2);
    expect(result.cpl).toBeCloseTo(1.666, 2);
    expect(result.formula).toContain('Cpk = min');
  });
});
