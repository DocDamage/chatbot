import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

export class DoePlannerTool implements Tool {
  id = 'plan_doe';
  name = 'plan_doe';
  description = 'Plan a full-factorial DOE design matrix and warn about interactions.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'factors', type: 'array' as const, description: 'Factors with name and levels', required: true }];

  plan(factors: Array<{ name: string; levels: Array<string | number> }>) {
    const designMatrix = factors.reduce<Array<Record<string, string | number>>>((runs, factor) => {
      const base = runs.length ? runs : [{}];
      return base.flatMap(run => factor.levels.map(level => ({ ...run, [factor.name]: level })));
    }, []);
    return {
      factors,
      levels: Object.fromEntries(factors.map(factor => [factor.name, factor.levels])),
      runs: designMatrix.length,
      designMatrix,
      mainEffects: factors.map(factor => factor.name),
      interactionWarnings: factors.length > 3 ? ['Full factorial run count grows quickly; consider fractional factorial screening.'] : [],
      anovaSummary: 'Run experiment, calculate main effects/interactions, then use ANOVA to test significance.'
    };
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.plan(params.factors || []), metadata: { executionTime: 0 } };
  }
}
