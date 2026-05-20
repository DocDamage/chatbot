export class FLRenderTool {
  run(input: Record<string, any> = {}) {
    return {
      domain: 'flstudio',
      tool: 'FLRenderTool',
      supported: false,
      reason: 'Render/export must remain confirmation-gated and depends on the installed FL MCP bridge exposing render commands.',
      requestedTarget: input.target || 'rough mix'
    };
  }
}
