import * as path from 'path';
import { CommandCapability, LanguageCapability, LanguageDetectionResult } from './LanguageCapability';

const command = (executable: string, args: string[], purpose: CommandCapability['purpose'], approval: CommandCapability['approval'] = 'read_only'): CommandCapability => ({ executable, args, purpose, approval });

const builtins: LanguageCapability[] = [
  { id: 'c', aliases: ['c'], extensions: ['.c', '.h'], commonFilenames: [], generatedFilePatterns: [/\.generated\./i], manifestFiles: [], buildSystems: ['cmake', 'make', 'meson', 'ninja'], commands: [command('cmake', ['--build', '.'], 'build'), command('ctest', [], 'test')] },
  { id: 'cpp', aliases: ['c++', 'cplusplus'], extensions: ['.cc', '.cpp', '.cxx', '.hpp', '.hh', '.hxx'], commonFilenames: [], generatedFilePatterns: [/\.generated\./i], manifestFiles: ['CMakeLists.txt', 'Makefile', 'meson.build'], buildSystems: ['cmake', 'make', 'meson', 'ninja'], commands: [command('cmake', ['--build', '.'], 'build'), command('ctest', [], 'test')] },
  { id: 'objective-c', aliases: ['objc', 'objective-c'], extensions: ['.m', '.mm'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['Podfile'], buildSystems: ['xcode'], commands: [command('xcodebuild', [], 'build')] },
  { id: 'csharp', aliases: ['c#', 'dotnet'], extensions: ['.cs'], commonFilenames: ['global.json', 'Directory.Build.props', 'Directory.Build.targets'], generatedFilePatterns: [], manifestFiles: ['.sln', '.csproj', 'global.json'], buildSystems: ['dotnet', 'msbuild'], commands: [command('dotnet', ['build'], 'build'), command('dotnet', ['test'], 'test')] },
  { id: 'fsharp', aliases: ['f#'], extensions: ['.fs', '.fsx', '.fsi'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['.fsproj'], buildSystems: ['dotnet'], commands: [command('dotnet', ['build'], 'build'), command('dotnet', ['test'], 'test')] },
  { id: 'go', aliases: ['golang'], extensions: ['.go'], commonFilenames: [], generatedFilePatterns: ['_generated.go'].map(value => new RegExp(value.replace('.', '\\.'), 'i')), manifestFiles: ['go.mod', 'go.sum', 'go.work'], buildSystems: ['go'], commands: [command('gofmt', ['-w'], 'format', 'write'), command('go', ['test', './...'], 'test'), command('go', ['vet', './...'], 'lint')] },
  { id: 'rust', aliases: [], extensions: ['.rs'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['Cargo.toml', 'Cargo.lock'], buildSystems: ['cargo'], commands: [command('cargo', ['check'], 'typecheck'), command('cargo', ['test'], 'test'), command('cargo', ['fmt', '--check'], 'format'), command('cargo', ['clippy'], 'lint')] },
  { id: 'python', aliases: ['py'], extensions: ['.py', '.pyi'], commonFilenames: [], generatedFilePatterns: [/__pycache__/i], manifestFiles: ['pyproject.toml', 'requirements.txt', 'setup.py', 'tox.ini', 'Pipfile', 'poetry.lock', 'uv.lock'], buildSystems: ['python'], commands: [command('pytest', [], 'test'), command('ruff', ['check', '.'], 'lint'), command('mypy', ['.'], 'typecheck')] },
  { id: 'lua', aliases: [], extensions: ['.lua'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['.luacheckrc'], buildSystems: ['lua'], commands: [command('luacheck', ['.'], 'lint')] },
  { id: 'luau', aliases: [], extensions: ['.luau'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['wally.toml'], buildSystems: ['luau'], commands: [] },
  { id: 'java', aliases: [], extensions: ['.java'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['pom.xml', 'settings.gradle', 'build.gradle'], buildSystems: ['maven', 'gradle'], commands: [command('mvn', ['test'], 'test'), command('gradle', ['test'], 'test')] },
  { id: 'kotlin', aliases: ['kt'], extensions: ['.kt', '.kts'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['settings.gradle.kts', 'build.gradle.kts'], buildSystems: ['gradle'], commands: [command('gradle', ['test'], 'test')] },
  { id: 'swift', aliases: [], extensions: ['.swift'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['Package.swift'], buildSystems: ['swiftpm', 'xcode'], commands: [command('swift', ['build'], 'build'), command('swift', ['test'], 'test')] },
  { id: 'javascript', aliases: ['js', 'node'], extensions: ['.js', '.jsx', '.mjs', '.cjs'], commonFilenames: [], generatedFilePatterns: [/\.min\.js$/i], manifestFiles: ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'], buildSystems: ['npm', 'pnpm', 'yarn', 'bun'], commands: [command('npm', ['test'], 'test'), command('npm', ['run', 'build'], 'build')] },
  { id: 'typescript', aliases: ['ts'], extensions: ['.ts', '.tsx'], commonFilenames: ['tsconfig.json'], generatedFilePatterns: [], manifestFiles: ['package.json', 'tsconfig.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'], buildSystems: ['npm', 'pnpm', 'yarn', 'bun'], commands: [command('npm', ['run', 'type-check'], 'typecheck'), command('npm', ['test'], 'test'), command('npm', ['run', 'build'], 'build')] },
  { id: 'svelte', aliases: [], extensions: ['.svelte'], commonFilenames: ['svelte.config.js', 'svelte.config.ts'], generatedFilePatterns: [], manifestFiles: ['package.json'], buildSystems: ['npm', 'pnpm', 'yarn'], commands: [command('npm', ['run', 'check'], 'typecheck'), command('npm', ['run', 'build'], 'build')], frameworkMarkers: ['svelte'] },
  { id: 'react', aliases: [], extensions: ['.jsx', '.tsx'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['package.json'], buildSystems: ['npm', 'pnpm', 'yarn'], commands: [command('npm', ['test'], 'test'), command('npm', ['run', 'build'], 'build')], frameworkMarkers: ['react'] },
  { id: 'html', aliases: [], extensions: ['.html', '.htm'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'css', aliases: ['scss', 'tailwind'], extensions: ['.css', '.scss', '.sass'], commonFilenames: ['tailwind.config.js', 'tailwind.config.ts'], generatedFilePatterns: [], manifestFiles: ['package.json'], buildSystems: ['npm'], commands: [command('npm', ['run', 'lint'], 'lint')] },
  { id: 'sql', aliases: [], extensions: ['.sql'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'bash', aliases: ['shell', 'sh'], extensions: ['.sh', '.bash'], commonFilenames: ['Bashfile'], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [command('shellcheck', [], 'lint')] },
  { id: 'powershell', aliases: ['pwsh', 'ps'], extensions: ['.ps1', '.psm1', '.psd1'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [command('PSScriptAnalyzer', [], 'lint')] },
  { id: 'gdscript', aliases: ['godot'], extensions: ['.gd'], commonFilenames: ['project.godot'], generatedFilePatterns: [], manifestFiles: ['project.godot'], buildSystems: ['godot'], commands: [command('godot', ['--headless', '--editor', '--quit'], 'build')] },
  { id: 'glsl', aliases: ['shader'], extensions: ['.glsl', '.vert', '.frag'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'hlsl', aliases: [], extensions: ['.hlsl', '.fx', '.fxh'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'wgsl', aliases: [], extensions: ['.wgsl'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'json', aliases: [], extensions: ['.json', '.jsonc'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'yaml', aliases: ['yml'], extensions: ['.yaml', '.yml'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'toml', aliases: [], extensions: ['.toml'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'xml', aliases: [], extensions: ['.xml'], commonFilenames: [], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'markdown', aliases: ['md'], extensions: ['.md', '.mdx'], commonFilenames: ['README', 'CONTRIBUTING', 'AGENTS.md'], generatedFilePatterns: [], manifestFiles: [], buildSystems: [], commands: [] },
  { id: 'dockerfile', aliases: ['docker'], extensions: [], commonFilenames: ['Dockerfile', 'Containerfile'], generatedFilePatterns: [], manifestFiles: ['docker-compose.yml', 'docker-compose.yaml'], buildSystems: ['docker'], commands: [command('docker', ['build', '.'], 'build')] },
  { id: 'make', aliases: ['makefile'], extensions: [], commonFilenames: ['Makefile', 'makefile', 'GNUmakefile'], generatedFilePatterns: [], manifestFiles: [], buildSystems: ['make'], commands: [command('make', [], 'build')] },
  { id: 'cmake', aliases: [], extensions: ['.cmake'], commonFilenames: ['CMakeLists.txt'], generatedFilePatterns: [], manifestFiles: ['CMakeLists.txt'], buildSystems: ['cmake'], commands: [command('cmake', ['--build', '.'], 'build')] },
  { id: 'meson', aliases: [], extensions: [], commonFilenames: ['meson.build', 'meson_options.txt'], generatedFilePatterns: [], manifestFiles: ['meson.build'], buildSystems: ['meson'], commands: [command('meson', ['compile', '-C', 'build'], 'build'), command('meson', ['test', '-C', 'build'], 'test')] },
  { id: 'cargo', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['Cargo.toml'], buildSystems: ['cargo'], commands: [command('cargo', ['check'], 'typecheck')] },
  { id: 'go-modules', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['go.mod', 'go.work'], buildSystems: ['go'], commands: [command('go', ['test', './...'], 'test')] },
  { id: 'python-packaging', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['pyproject.toml', 'setup.py', 'requirements.txt'], buildSystems: ['python'], commands: [] },
  { id: 'npm', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['package.json', 'package-lock.json'], buildSystems: ['npm'], commands: [command('npm', ['test'], 'test')] },
  { id: 'pnpm', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'], buildSystems: ['pnpm'], commands: [command('pnpm', ['test'], 'test')] },
  { id: 'yarn', aliases: [], extensions: [], commonFilenames: [], generatedFilePatterns: [], manifestFiles: ['yarn.lock'], buildSystems: ['yarn'], commands: [command('yarn', ['test'], 'test')] }
];

export class LanguageCapabilityRegistry {
  private readonly capabilities = new Map<string, LanguageCapability>();

  constructor(entries: LanguageCapability[] = builtins) {
    entries.forEach(entry => this.register(entry));
  }

  register(capability: LanguageCapability): void {
    if (this.capabilities.has(capability.id)) throw new Error(`Language capability already registered: ${capability.id}`);
    this.capabilities.set(capability.id, Object.freeze({ ...capability, aliases: [...capability.aliases], extensions: [...capability.extensions], commonFilenames: [...capability.commonFilenames] }));
  }

  get(idOrAlias: string): LanguageCapability | undefined {
    const normalized = idOrAlias.toLowerCase();
    return [...this.capabilities.values()].find(capability => capability.id === normalized || capability.aliases.includes(normalized));
  }

  all(): LanguageCapability[] { return [...this.capabilities.values()]; }

  detect(files: string[], manifests: Record<string, unknown> = {}): LanguageDetectionResult {
    const evidence = new Map<string, { confidence: number; reasons: Set<string>; files: Set<string> }>();
    for (const file of files) {
      const name = path.basename(file).toLowerCase();
      const extension = path.extname(name);
      for (const capability of this.capabilities.values()) {
        let confidence = 0;
        const reasons = new Set<string>();
        if (capability.extensions.includes(extension)) { confidence += 0.65; reasons.add(`extension:${extension}`); }
        if (capability.commonFilenames.some(filename => filename.toLowerCase() === name || filename.toLowerCase() === path.basename(name, extension))) { confidence += 0.8; reasons.add(`filename:${path.basename(file)}`); }
        if (capability.manifestFiles.some(manifest => manifest.toLowerCase() === name)) { confidence += 0.75; reasons.add(`manifest:${path.basename(file)}`); }
        if (confidence > 0) {
          const current = evidence.get(capability.id) || { confidence: 0, reasons: new Set<string>(), files: new Set<string>() };
          current.confidence = Math.min(1, current.confidence + confidence);
          reasons.forEach(reason => current.reasons.add(reason));
          current.files.add(file);
          evidence.set(capability.id, current);
        }
      }
    }
    for (const manifest of Object.keys(manifests)) {
      for (const capability of this.capabilities.values()) {
        if (capability.manifestFiles.some(file => file.toLowerCase() === manifest.toLowerCase())) {
          const current = evidence.get(capability.id) || { confidence: 0, reasons: new Set<string>(), files: new Set<string>() };
          current.confidence = Math.min(1, current.confidence + 0.3);
          current.reasons.add(`manifest-data:${manifest}`);
          current.files.add(manifest);
          evidence.set(capability.id, current);
        }
      }
    }
    const languages = [...evidence.entries()]
      .map(([language, value]) => ({ language, confidence: Math.min(1, value.confidence), reasons: [...value.reasons], files: [...value.files] }))
      .filter(item => item.confidence >= 0.35)
      .sort((a, b) => b.confidence - a.confidence);
    const frameworks: string[] = [];
    for (const item of languages) {
      const capability = this.capabilities.get(item.language);
      if (capability?.frameworkMarkers?.some(marker => files.some(file => file.toLowerCase().includes(marker.toLowerCase())) || Object.values(manifests).some(manifest => JSON.stringify(manifest).toLowerCase().includes(marker.toLowerCase())))) frameworks.push(...(capability.frameworkMarkers || []));
      frameworks.push(...(capability?.detectFrameworks?.(files, manifests) || []));
    }
    const conflicts = languages.length > 1 && languages[0].confidence - languages[1].confidence < 0.1
      ? [`Multiple ecosystems detected with similar confidence: ${languages.slice(0, 4).map(item => item.language).join(', ')}`]
      : [];
    return { languages, frameworks: [...new Set(frameworks)], conflicts };
  }
}

export const defaultLanguageCapabilityRegistry = (): LanguageCapabilityRegistry => new LanguageCapabilityRegistry();
