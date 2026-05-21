import { assertActionAllowed, isActionAllowed, modeFromRequest, normalizeWorkMode } from './ExecutionModePolicy';

describe('ExecutionModePolicy', () => {
  it('normalizes unknown modes to chat', () => {
    expect(normalizeWorkMode(undefined)).toBe('chat');
    expect(normalizeWorkMode('unknown')).toBe('chat');
    expect(normalizeWorkMode('implement')).toBe('implement');
  });

  it('allows and blocks actions by work mode', () => {
    expect(isActionAllowed('plan', 'create_plan')).toBe(true);
    expect(isActionAllowed('plan', 'write_files')).toBe(false);
    expect(isActionAllowed('implement', 'create_patch')).toBe(true);
    expect(isActionAllowed('debug', 'run_tests')).toBe(true);
    expect(isActionAllowed('chat', 'chat')).toBe(true);
  });

  it('throws clear errors for blocked actions', () => {
    expect(() => assertActionAllowed('plan', 'write_files')).toThrow(/not allowed in plan mode/);
  });

  it('prefers header mode over body mode', () => {
    expect(modeFromRequest({ headerMode: 'debug', bodyMode: 'implement' })).toBe('debug');
  });
});
