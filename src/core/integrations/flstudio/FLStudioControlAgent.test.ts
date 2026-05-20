import { FLStudioControlAgent } from './FLStudioControlAgent';

describe('FLStudioControlAgent', () => {
  it('defaults to dry-run execution when no MCP server is connected', async () => {
    const agent = new FLStudioControlAgent();
    const result = await agent.command('Make a four-bar dark trap progression in F minor');

    expect(result.mode).toBe('fl_studio_control');
    expect(result.controlMode).toBe('dry_run');
    expect(result.dryRun).toBe(true);
    expect(result.actions.some(action => action.tool === 'fl_send_chord')).toBe(true);
    expect(result.response).toContain('planned');
  });

  it('blocks risky record commands in confirm-required mode without confirmation', async () => {
    const agent = new FLStudioControlAgent();
    const result = await agent.command('Record enable FL Studio', { mode: 'confirm_required' });

    expect(result.results[0].blocked).toBe(true);
    expect(result.results[0].decision.requiresConfirmation).toBe(true);
  });
});
