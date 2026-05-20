import { BalanceSimTool, BalanceSimInput } from '../../tools/gamedev/BalanceSimTool';

export class BalanceSimulator {
  constructor(private readonly tool = new BalanceSimTool()) {}

  simulate(input: BalanceSimInput) {
    return this.tool.simulate(input);
  }
}
