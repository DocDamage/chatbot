export class SampleClearanceAdvisorTool {
  run(input: Record<string, any> = {}) {
    const useCase = String(input.useCase || 'release');
    return {
      domain: 'music',
      tool: 'SampleClearanceAdvisorTool',
      useCase,
      guidance: [
        'For commercial release, assume both the master recording and composition may need clearance.',
        'Replay/interpolation can avoid master clearance, but composition publishing still may apply.',
        'Royalty-free packs still require reading license terms, especially for content ID, resale, and exclusive-use limits.',
        'Do not rely on “short sample” myths; risk depends on rights, recognizability, jurisdiction, and distribution.',
        'When in doubt, replace the sample with an original sound-alike texture rather than copying the recording.'
      ],
      disclaimer: 'Sample clearance guidance, not legal advice.'
    };
  }
}
