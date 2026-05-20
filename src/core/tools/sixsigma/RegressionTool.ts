import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class RegressionTool implements Tool {
  id = 'calculate_regression';
  name = 'calculate_regression';
  description = 'Calculate simple linear regression slope, intercept, correlation, and R squared.';
  category = ToolCategory.CALCULATION;
  parameters = [
    { name: 'x', type: 'array' as const, description: 'X values', required: true },
    { name: 'y', type: 'array' as const, description: 'Y values', required: true }
  ];

  calculate(x: number[], y: number[]) {
    if (x.length !== y.length || x.length < 2) throw new Error('x and y must have the same length of at least 2');
    const meanX = mean(x);
    const meanY = mean(y);
    const numerator = x.reduce((sum, xi, index) => sum + (xi - meanX) * ((y[index] || 0) - meanY), 0);
    const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    const ssTotal = y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0);
    const ssResidual = y.reduce((sum, yi, index) => sum + (yi - (intercept + slope * (x[index] || 0))) ** 2, 0);
    const rSquared = 1 - ssResidual / ssTotal;
    return { slope, intercept, rSquared, equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}` };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    try {
      return { success: true, data: this.calculate(params.x, params.y), metadata: { executionTime: 0 } };
    } catch (error: any) {
      return { success: false, error: error.message, metadata: { executionTime: 0 } };
    }
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
