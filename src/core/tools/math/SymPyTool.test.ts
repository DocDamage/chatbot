import { SymPyTool } from './SymPyTool';

describe('SymPyTool', () => {
  it('differentiates common symbolic expressions even when Python SymPy is unavailable', async () => {
    const tool = new SymPyTool({ preferPython: false });

    const result = await tool.differentiate('x^2*sin(x)', 'x');

    expect(result.success).toBe(true);
    expect(result.result).toBe('2*x*sin(x) + x^2*cos(x)');
    expect(result.verified).toBe(true);
  });
});
