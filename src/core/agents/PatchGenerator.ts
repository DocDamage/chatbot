export interface GeneratedPatch {
  format: 'unified-diff';
  diff: string;
  filesChanged: string[];
  explanation: string;
}

export class PatchGenerator {
  createEmptyPatch(explanation = 'No patch generated. The agent inspected the repo and answered from existing files.'): GeneratedPatch {
    return {
      format: 'unified-diff',
      diff: '',
      filesChanged: [],
      explanation
    };
  }
}
