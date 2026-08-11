import { CommandCapabilityRunner } from './CommandCapabilityRunner';

describe('CommandCapabilityRunner', () => {
  it('uses argv execution and bounds long-running processes', async () => {
    const result = await new CommandCapabilityRunner(process.cwd(), 20).run({ executable: process.execPath, argv: ['-e', 'setTimeout(() => {}, 1000)'], purpose: 'test', source: 'fixture', supported: true });
    expect(result.status).toBe('timed_out');
    expect(result.reason).toContain('Timed out');
  });

  it('blocks commands not authorized by detected project state', async () => {
    const result = await new CommandCapabilityRunner(process.cwd()).run({ executable: 'unknown', argv: [], purpose: 'test', source: 'fixture', supported: false, reason: 'not detected' });
    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('not detected');
  });
});
