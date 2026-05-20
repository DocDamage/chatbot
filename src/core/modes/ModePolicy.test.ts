import {
  canApplyPatch,
  canDebug,
  canGeneratePatch,
  canImplement,
  canPlan,
  canRunCommands,
  detectUserIntent,
  requiresSwitchForIntent
} from './ModePolicy';

describe('ModePolicy', () => {
  it('keeps planning, implementation, and debugging permissions separate', () => {
    expect(canPlan('plan')).toBe(true);
    expect(canImplement('plan')).toBe(false);
    expect(canGeneratePatch('plan')).toBe(false);
    expect(canApplyPatch('plan')).toBe(false);

    expect(canImplement('implement')).toBe(true);
    expect(canGeneratePatch('implement')).toBe(true);
    expect(canApplyPatch('implement')).toBe(true);
    expect(canDebug('implement')).toBe(false);

    expect(canDebug('debug')).toBe(true);
    expect(canRunCommands('debug')).toBe(true);
  });

  it('detects debug and implementation intents from user text', () => {
    expect(detectUserIntent('TypeError: Cannot read properties of undefined')).toBe('debug');
    expect(detectUserIntent('implement a saved plan for the file explorer')).toBe('implement');
    expect(detectUserIntent('write a markdown plan for adding auth')).toBe('plan');
  });

  it('requires explicit mode switches for protected intents', () => {
    expect(requiresSwitchForIntent('ask', 'debug')).toEqual({
      required: true,
      targetMode: 'debug',
      message: 'Debugging is only available in Debug mode. Switch to Debug to investigate this issue.'
    });
    expect(requiresSwitchForIntent('plan', 'implement')?.targetMode).toBe('implement');
    expect(requiresSwitchForIntent('debug', 'debug')).toEqual({ required: false });
  });
});
