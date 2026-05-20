import { ReferenceCompareTool } from '../../../tools/audio/ReferenceCompareTool';

export class ReferenceMixAnalyzer {
  private referenceCompare = new ReferenceCompareTool();

  compare(input: Record<string, any>) {
    return this.referenceCompare.run({
      reference: input.reference,
      target: input.target
    });
  }
}
