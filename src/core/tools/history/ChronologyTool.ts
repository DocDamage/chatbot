import { TimeRangeParser } from '../../chrono/TimeRangeParser';
export class ChronologyTool {
  private parser = new TimeRangeParser();
  parse(input: string) {
    return this.parser.parse(input);
  }
}
