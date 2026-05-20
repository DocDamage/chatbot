import { Tool, ToolCategory, ToolResult } from '../../../types/tools';

const CONSTANTS: Record<number, Record<string, number>> = {
  2: { A2: 1.880, A3: 2.659, d2: 1.128, D3: 0, D4: 3.267, B3: 0, B4: 3.267 },
  3: { A2: 1.023, A3: 1.954, d2: 1.693, D3: 0, D4: 2.574, B3: 0, B4: 2.568 },
  4: { A2: 0.729, A3: 1.628, d2: 2.059, D3: 0, D4: 2.282, B3: 0, B4: 2.266 },
  5: { A2: 0.577, A3: 1.427, d2: 2.326, D3: 0, D4: 2.114, B3: 0, B4: 2.089 },
  6: { A2: 0.483, A3: 1.287, d2: 2.534, D3: 0.030, D4: 2.004, B3: 0.030, B4: 1.970 },
  7: { A2: 0.419, A3: 1.182, d2: 2.704, D3: 0.076, D4: 1.924, B3: 0.118, B4: 1.882 },
  8: { A2: 0.373, A3: 1.099, d2: 2.847, D3: 0.136, D4: 1.864, B3: 0.185, B4: 1.815 },
  9: { A2: 0.337, A3: 1.032, d2: 2.970, D3: 0.184, D4: 1.816, B3: 0.239, B4: 1.761 },
  10: { A2: 0.308, A3: 0.975, d2: 3.078, D3: 0.223, D4: 1.777, B3: 0.284, B4: 1.716 }
};

export class ControlChartConstantsTool implements Tool {
  id = 'get_control_chart_constants';
  name = 'get_control_chart_constants';
  description = 'Return SPC control chart constants by subgroup size.';
  category = ToolCategory.CALCULATION;
  parameters = [{ name: 'subgroupSize', type: 'number' as const, description: 'Subgroup size 2-10', required: true }];

  get(subgroupSize: number) {
    return CONSTANTS[subgroupSize] || CONSTANTS[5];
  }

  async execute(params: Record<string, any>): Promise<ToolResult> {
    return { success: true, data: this.get(params.subgroupSize), metadata: { executionTime: 0 } };
  }
}
