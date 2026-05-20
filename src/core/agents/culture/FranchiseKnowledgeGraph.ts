import { FranchiseGraphTool } from '../../tools/culture/FranchiseGraphTool';

export class FranchiseKnowledgeGraph {
  constructor(private readonly tool = new FranchiseGraphTool()) {}
  graph(franchise: string) {
    return this.tool.graph(franchise);
  }
}
