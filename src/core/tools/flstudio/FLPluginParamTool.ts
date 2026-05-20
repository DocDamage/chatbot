export class FLPluginParamTool {
  run(input: Record<string, any> = {}) {
    return {
      domain: 'flstudio',
      tool: 'FLPluginParamTool',
      safeOnly: true,
      note: 'Can only set parameters for plugins already loaded and exposed by the FL Studio MCP bridge.',
      action: {
        tool: 'fl_set_plugin_param_value',
        args: {
          track: input.track,
          plugin: input.plugin,
          param: input.param,
          value: input.value
        }
      }
    };
  }
}
