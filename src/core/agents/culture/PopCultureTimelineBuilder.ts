import { PopCultureTimelineTool } from '../../tools/culture/PopCultureTimelineTool';

export class PopCultureTimelineBuilder {
  constructor(private readonly tool = new PopCultureTimelineTool()) {}
  build(query: string) {
    return this.tool.build(query);
  }
}
