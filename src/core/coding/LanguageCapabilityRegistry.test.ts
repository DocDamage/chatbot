import { LanguageCapabilityRegistry } from './languages/LanguageCapabilityRegistry';

describe('LanguageCapabilityRegistry', () => {
  it('detects polyglot projects from extensions and manifests', () => {
    const result = new LanguageCapabilityRegistry().detect([
      'src/main.go', 'Cargo.toml', 'src/lib.rs', 'pyproject.toml', 'src/app.py', 'package.json', 'src/App.svelte', 'CMakeLists.txt'
    ]);
    expect(result.languages.map(item => item.language)).toEqual(expect.arrayContaining(['go', 'rust', 'python', 'typescript', 'svelte', 'cmake']));
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('keeps command selection descriptive and project-derived', () => {
    const registry = new LanguageCapabilityRegistry();
    const rust = registry.get('rust');
    expect(rust?.commands.some(command => command.executable === 'cargo')).toBe(true);
    expect(registry.get('c++')?.id).toBe('cpp');
  });
});
