import { BpmKeyDetectorTool } from './BpmKeyDetectorTool';

export class BpmTool {
  private detector = new BpmKeyDetectorTool();

  run(input: Record<string, any> = {}) {
    return {
      ...this.detector.run(input),
      domain: 'music',
      tool: 'BpmTool',
      usage: 'Use BPM to choose grid density, performance feel, delay timing, and arrangement energy.'
    };
  }
}
