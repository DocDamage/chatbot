export class ReferenceCompareTool {
  run(input: Record<string, any> = {}) {
    return {
      domain: 'audio',
      tool: 'ReferenceCompareTool',
      reference: input.reference || 'none provided',
      comparison: input.reference
        ? ['Match perceived loudness before judging tone.', 'Compare vocal level, low-end shape, width, and brightness.']
        : ['No reference provided; use genre target profile instead.'],
      caveat: 'Reference matching should guide balance, not copy another record.'
    };
  }
}
