import { MixGeniusAgent } from './MixGeniusAgent';

describe('MixGeniusAgent', () => {
  it('plans an 808-focused clean mix pass with approval-ready moves', () => {
    const agent = new MixGeniusAgent();
    const result = agent.plan({
      query: 'Make this beat mix cleaner and louder but keep the 808 huge.',
      genre: 'trap',
      lowEndTarget: 'huge'
    });

    expect(result.mode).toBe('beat_mix');
    expect(result.moves.map(move => move.id)).toContain('melody-low-mid');
    expect(result.response).toContain('Suggested moves');
    expect(result.response).toContain('FL Studio MCP connected');
  });

  it('dry-runs FL Studio mixer actions when applying a mix pass without a connected bridge', async () => {
    const agent = new MixGeniusAgent();
    const result = await agent.apply({
      query: 'Make this beat mix cleaner and louder but keep the 808 huge.',
      permissionMode: 'dry_run'
    });

    expect(result.flResult.dryRun).toBe(true);
    expect(result.flResult.actions.some((action: any) => action.tool === 'fl_set_track_volume')).toBe(true);
    expect(result.passReport.automatableMoves).toBeGreaterThan(0);
    expect(result.response).toContain('Before/after report');
  });

  it('normalizes confirm_each_move into the guarded confirmation mode', async () => {
    const agent = new MixGeniusAgent();
    const result = await agent.apply({
      query: 'Make this beat mix cleaner and louder but keep the 808 huge.',
      permissionMode: 'confirm_each_move'
    });

    expect(result.passReport.permissionMode).toBe('confirm_required');
  });
});
