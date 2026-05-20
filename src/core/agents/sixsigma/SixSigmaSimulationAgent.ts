import { ControlChartBuilderTool } from '../../tools/sixsigma/ControlChartBuilderTool';
import { DoePlannerTool } from '../../tools/sixsigma/DoePlannerTool';
import { ProcessMapAnalyzerTool } from '../../tools/sixsigma/ProcessMapAnalyzerTool';

export class SixSigmaSimulationAgent {
  private controlChart = new ControlChartBuilderTool();
  private doe = new DoePlannerTool();
  private processMap = new ProcessMapAnalyzerTool();

  simulate(input: string) {
    const text = input.toLowerCase();
    if (text.includes('doe') || text.includes('experiment')) {
      return this.doe.plan([{ name: 'A', levels: ['low', 'high'] }, { name: 'B', levels: ['low', 'high'] }]);
    }
    if (text.includes('process map')) {
      return this.processMap.analyze([{ name: 'Receive request', cycleTime: 5, waitTime: 20, valueAdded: true }, { name: 'Approve', cycleTime: 10, waitTime: 40, valueAdded: false }]);
    }
    return this.controlChart.build([10, 11, 10.5, 10.2, 15, 10.4, 10.3]);
  }
}
