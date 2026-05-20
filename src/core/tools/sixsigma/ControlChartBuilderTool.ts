import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class ControlChartBuilderTool implements Tool {
  id = 'build_control_chart';
  name = 'build_control_chart';
  description = 'Build an individuals control chart with center line, UCL/LCL, out-of-control points, and Western Electric checks.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'values', type: 'array' as const, description: 'Numeric process observations', required: true }];

  build(values: number[], chartType = 'I-MR') {
    const centerLine = mean(values);
    const movingRanges = values.slice(1).map((value, index) => Math.abs(value - (values[index] || value)));
    const mrBar = mean(movingRanges.length ? movingRanges : [0]);
    const sigma = mrBar / 1.128;
    const ucl = centerLine + 3 * sigma;
    const lcl = centerLine - 3 * sigma;
    const outOfControlPoints = values
      .map((value, index) => ({ index, value }))
      .filter(point => point.value > ucl || point.value < lcl);
    return {
      chartType,
      centerLine,
      ucl,
      lcl,
      outOfControlPoints,
      westernElectricRuleViolations: outOfControlPoints.map(point => ({ ...point, rule: 'Point beyond 3 sigma control limit' })),
      recommendedAction: outOfControlPoints.length ? 'Investigate special causes before recalculating control limits.' : 'Continue monitoring common-cause variation.'
    };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.build(params.values || [], params.chartType), metadata: { executionTime: 0 } };
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
