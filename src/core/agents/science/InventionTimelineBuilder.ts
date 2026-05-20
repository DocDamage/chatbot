import { InventionTimelineTool } from '../../tools/science/InventionTimelineTool';
export class InventionTimelineBuilder {
  constructor(private readonly tool = new InventionTimelineTool()) {}
  build(query: string) {
    return this.tool.build(query);
  }
}
