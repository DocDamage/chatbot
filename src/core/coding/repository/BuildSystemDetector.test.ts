import { BuildSystemDetector } from './BuildSystemDetector';

describe('BuildSystemDetector', () => {
  it('does not authorize package scripts that are absent from package.json', () => {
    const manifests = [{ path: 'package.json', kind: 'package.json', data: { scripts: { build: 'tsc' } } }];
    const result = new BuildSystemDetector().detect(['package.json', 'src/app.ts'], manifests);
    const testCommands = result.commands.filter(command => command.executable === 'npm' && command.purpose === 'test');
    expect(testCommands.every(command => command.supported)).toBe(false);
  });

  it('does not infer unrelated native or managed commands from an arbitrary manifest', () => {
    const manifests = [{ path: 'package.json', kind: 'package.json', data: { scripts: { test: 'node test.js' } } }];
    const result = new BuildSystemDetector().detect(['package.json', 'src/app.rs', 'src/App.cs'], manifests);
    expect(result.commands.filter(command => ['cargo', 'dotnet'].includes(command.executable)).every(command => !command.supported)).toBe(true);
  });
});
