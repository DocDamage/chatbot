export class ProToolsEditWorkflowTool {
  run(input: Record<string, any> = {}) {
    return {
      domain: 'music',
      tool: 'ProToolsEditWorkflowTool',
      editing: ['set grid/slip mode intentionally', 'use tab-to-transient for drums/dialogue as needed', 'clip gain before plugins', 'crossfade all audible edits']
    };
  }
}
