import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { ManifestRecord } from './ManifestDetector';

export interface BuildCommandPlan { executable: string; argv: string[]; purpose: string; source: string; supported: boolean; reason?: string; }

export class BuildSystemDetector {
  constructor(private readonly registry = new LanguageCapabilityRegistry()) {}

  detect(files: string[], manifests: ManifestRecord[]): { systems: string[]; commands: BuildCommandPlan[] } {
    const detection = this.registry.detect(files, Object.fromEntries(manifests.map(item => [item.path, item.data || {}])));
    const systems = [...new Set(detection.languages.flatMap(item => this.registry.get(item.language)?.buildSystems || []))];
    const commands: BuildCommandPlan[] = [];
    for (const language of detection.languages) {
      const capability = this.registry.get(language.language);
      if (!capability) continue;
      for (const candidate of capability.commands) {
        const present = this.hasExecutableSource(candidate.executable, candidate.args, files, manifests, systems);
        commands.push({ executable: candidate.executable, argv: candidate.args, purpose: candidate.purpose, source: language.language, supported: present, reason: present ? undefined : `No detected project configuration authorizes ${candidate.executable}` });
      }
    }
    return { systems, commands: this.dedupe(commands) };
  }

  private hasExecutableSource(executable: string, args: string[], files: string[], manifests: ManifestRecord[], systems: string[]): boolean {
    const normalizedFiles = files.map(file => file.replace(/\\/g, '/').toLowerCase());
    const names = new Set(normalizedFiles.map(file => file.split('/').pop() || file));
    const manifestKinds = new Set(manifests.map(manifest => manifest.kind.toLowerCase()));
    const hasSource = (extensions: string[]): boolean => normalizedFiles.some(file => extensions.some(extension => file.endsWith(extension)));
    const hasAny = (...values: string[]): boolean => values.some(value => names.has(value.toLowerCase()) || manifestKinds.has(value.toLowerCase()));
    if (['npm', 'pnpm', 'yarn'].includes(executable)) {
      const packageManifest = manifests.find(manifest => manifest.kind === 'package.json');
      const scripts = packageManifest?.data?.scripts;
      const scriptName = args[0] === 'run' ? args[1] : args[0];
      return Boolean(scripts && typeof scripts === 'object' && scriptName && Object.prototype.hasOwnProperty.call(scripts, scriptName));
    }
    switch (executable) {
      case 'cmake': return hasAny('cmakelists.txt');
      case 'ctest': return hasAny('cmakelists.txt') && (systems.includes('cmake') || systems.includes('ninja'));
      case 'make': return hasAny('makefile', 'gnumakefile');
      case 'meson': return hasAny('meson.build');
      case 'go': return hasSource(['.go']) && hasAny('go.mod', 'go.work');
      case 'gofmt': return hasSource(['.go']);
      case 'cargo': return hasAny('cargo.toml');
      case 'dotnet': return hasSource(['.cs', '.fs', '.fsx', '.fsi']) && normalizedFiles.some(file => /\.(sln|csproj|fsproj)$/.test(file));
      case 'mvn': return hasSource(['.java']) && hasAny('pom.xml');
      case 'gradle': return hasSource(['.java', '.kt', '.kts']) && normalizedFiles.some(file => /(^|\/)(build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/.test(file));
      case 'swift': return hasSource(['.swift']) && hasAny('package.swift');
      case 'pytest': return hasSource(['.py', '.pyi']) && hasAny('pyproject.toml', 'requirements.txt', 'setup.py', 'tox.ini', 'pipfile', 'poetry.lock', 'uv.lock');
      case 'ruff':
      case 'mypy': return hasSource(['.py', '.pyi']) && hasAny('pyproject.toml', 'setup.cfg', 'mypy.ini', 'requirements.txt', 'tox.ini', 'pipfile', 'poetry.lock', 'uv.lock');
      case 'shellcheck': return hasSource(['.sh', '.bash']);
      case 'PSScriptAnalyzer': return hasSource(['.ps1', '.psm1', '.psd1']);
      case 'xcodebuild': return hasSource(['.m', '.mm', '.swift']) && normalizedFiles.some(file => /\.(xcodeproj|xcworkspace)$/.test(file));
      case 'godot': return hasAny('project.godot');
      case 'docker': return hasAny('dockerfile', 'containerfile');
      default: return false;
    }
  }

  private dedupe(commands: BuildCommandPlan[]): BuildCommandPlan[] {
    const seen = new Set<string>();
    return commands.filter(command => { const key = `${command.executable}\0${command.argv.join('\0')}\0${command.purpose}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
}
