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
    const system = executable === 'npm' || executable === 'pnpm' || executable === 'yarn' ? executable : executable;
    if (['npm', 'pnpm', 'yarn'].includes(executable)) {
      const packageManifest = manifests.find(manifest => manifest.kind === 'package.json');
      const scripts = packageManifest?.data?.scripts;
      const scriptName = args[0] === 'run' ? args[1] : args[0];
      return Boolean(scripts && typeof scripts === 'object' && scriptName && Object.prototype.hasOwnProperty.call(scripts, scriptName));
    }
    return systems.includes(system) || manifests.length > 0 && ['go', 'cargo', 'dotnet', 'mvn', 'gradle', 'swift', 'cmake', 'meson', 'make', 'pytest', 'ruff', 'mypy', 'shellcheck', 'PSScriptAnalyzer'].includes(executable) && files.length > 0;
  }

  private dedupe(commands: BuildCommandPlan[]): BuildCommandPlan[] {
    const seen = new Set<string>();
    return commands.filter(command => { const key = `${command.executable}\0${command.argv.join('\0')}\0${command.purpose}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
}
