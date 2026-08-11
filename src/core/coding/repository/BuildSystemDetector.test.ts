import { BuildSystemDetector } from './BuildSystemDetector';

describe('BuildSystemDetector', () => {
  it('does not authorize package scripts that are absent from package.json', () => {
    const manifests = [{ path: 'package.json', kind: 'package.json', data: { scripts: { build: 'tsc' } } }];
    const result = new BuildSystemDetector().detect(['package.json', 'src/app.ts'], manifests);
    const testCommands = result.commands.filter(command => command.executable === 'npm' && command.purpose === 'test');
    expect(testCommands.every(command => command.supported)).toBe(false);
  });
});
