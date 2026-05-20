import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class AnovaTool implements Tool {
  id = 'calculate_anova';
  name = 'calculate_anova';
  description = 'Calculate one-way ANOVA sums of squares, degrees of freedom, mean squares, and F statistic.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'groups', type: 'array' as const, description: 'Array of numeric groups', required: true }];

  calculate(groups: number[][]) {
    const all = groups.flat();
    const overallMean = mean(all);
    const groupMeans = groups.map(mean);
    const ssBetween = groups.reduce((sum, group, index) => sum + group.length * ((groupMeans[index] || 0) - overallMean) ** 2, 0);
    const ssWithin = groups.reduce((sum, group, index) => sum + group.reduce((inner, value) => inner + (value - (groupMeans[index] || 0)) ** 2, 0), 0);
    const dfBetween = groups.length - 1;
    const dfWithin = all.length - groups.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    return { ssBetween, ssWithin, dfBetween, dfWithin, msBetween, msWithin, fStatistic: msBetween / msWithin };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.calculate(params.groups), metadata: { executionTime: 0 } };
  }
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
