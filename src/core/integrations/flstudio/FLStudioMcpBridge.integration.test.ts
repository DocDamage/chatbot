import { FLStudioControlAgent } from './FLStudioControlAgent';

const runBridgeTest = process.env.RUN_FL_STUDIO_MCP_BRIDGE_TEST === 'true';

(runBridgeTest ? describe : describe.skip)('FL Studio MCP bridge integration', () => {
  it('connects to the installed MCP bridge and lists FL Studio tools', async () => {
    const agent = new FLStudioControlAgent();
    try {
      const connection = await agent.connect({ command: process.env.FL_STUDIO_MCP_COMMAND || 'fl-studio-mcp.cmd' });
      const tools = await agent.tools();

      expect(connection.connected).toBe(true);
      expect(tools.toolNames).toContain('fl_play');
      expect(tools.toolNames).toContain('fl_send_chord');
      expect(tools.toolNames.length).toBeGreaterThan(20);
    } finally {
      agent.disconnect();
    }
  }, 30000);
});
