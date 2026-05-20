import { BpmKeyDetectorTool } from './BpmKeyDetectorTool';

export class BpmTool {
  private detector = new BpmKeyDetectorTool();

  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'BpmTool',
      ...this.detector.run(input),
      usage: 'Use BPM to choose grid density, performance feel, delay timing, and arrangement energy.'
    };
  }
}
