import * as fs from 'fs';
import * as path from 'path';
import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { ProjectRootDetector, ProjectRoot } from './ProjectRootDetector';
import { WorkspaceInstruction, WorkspaceInstructionResolver } from './WorkspaceInstructionResolver';
import { ManifestDetector, ManifestRecord } from './ManifestDetector';
import { BuildCommandPlan, BuildSystemDetector } from './BuildSystemDetector';
import { SymbolIndex } from '../index/SymbolIndex';
import { RelationshipStore, CodeRelationship } from '../index/RelationshipStore';
import { isSensitiveWorkspacePath } from '../security/WorkspacePathPolicy';

export interface RepositoryFile { path: string; size: number; language?: string; generated: boolean; binary: boolean; }
export interface ParserHealth { parser: string; files: number; symbols: number; averageConfidence: number; fallback: boolean; }
export interface RepositorySnapshot { version: string; root: string; files: RepositoryFile[]; projectRoots: ProjectRoot[]; instructions: WorkspaceInstruction[]; manifests: ManifestRecord[]; languages: ReturnType<LanguageCapabilityRegistry['detect']>; buildSystems: string[]; commandPlans: BuildCommandPlan[]; relationships: CodeRelationship[]; parserHealth: ParserHealth[]; }

const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'coverage', 'build', '.next', '.venv', '.venv-pyscrappy',
  'target', 'obj', 'bin', '.gradle', '.idea', '.vscode', '.pytest_cache', '__pycache__',
  '.mypy_cache', '.ruff_cache', 'vendor', 'cache', 'logs', 'data', 'knowledge-base',
  'knowledge-base-public', '.mex', '.playwright-cli', '.remembrandt', '.tmp-skill-test'
]);

export class RepositoryIntelligence {
  private readonly registry: LanguageCapabilityRegistry;
  constructor(private readonly workspaceRoot: string, registry = new LanguageCapabilityRegistry()) { this.registry = registry; }

  snapshot(): RepositorySnapshot {
    const names = this.listFiles();
    const manifests = new ManifestDetector(this.workspaceRoot).inspect(names);
    const files = names.map(file => {
      const absolute = path.resolve(this.workspaceRoot, file);
      const stat = fs.statSync(absolute);
      const binary = this.isBinary(absolute);
      const language = this.registry.detect([file]).languages[0]?.language;
      return { path: file, size: stat.size, language, generated: this.isGenerated(file), binary };
    });
    const projectRoots = new ProjectRootDetector(this.workspaceRoot).detect(names);
    const instructions = new WorkspaceInstructionResolver(this.workspaceRoot).resolve(names);
    const languages = this.registry.detect(names, Object.fromEntries(manifests.map(item => [item.path, item.data || {}])));
    const build = new BuildSystemDetector(this.registry).detect(names, manifests);
    const indexableFiles = files.filter(file => !file.binary && this.isIndexable(file.path)).map(file => file.path);
    const index = new SymbolIndex(this.workspaceRoot);
    index.indexFiles(indexableFiles);
    const relationships = new RelationshipStore(this.workspaceRoot);
    relationships.build(indexableFiles, index.all());
    const parserGroups = new Map<string, { files: Set<string>; symbols: number; confidence: number }>();
    for (const symbol of index.all()) {
      const group = parserGroups.get(symbol.parser) || { files: new Set<string>(), symbols: 0, confidence: 0 };
      group.files.add(symbol.file); group.symbols += 1; group.confidence += symbol.confidence;
      parserGroups.set(symbol.parser, group);
    }
    const parserHealth = [...parserGroups.entries()].map(([parser, group]) => ({ parser, files: group.files.size, symbols: group.symbols, averageConfidence: group.symbols ? group.confidence / group.symbols : 0, fallback: parser.includes('fallback') })).sort((a, b) => b.averageConfidence - a.averageConfidence);
    return { version: this.version(names), root: path.resolve(this.workspaceRoot), files, projectRoots, instructions, manifests, languages, buildSystems: build.systems, commandPlans: build.commands, relationships: relationships.all(), parserHealth };
  }

  private listFiles(): string[] {
    const results: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (IGNORED.has(entry.name) || entry.name.startsWith('.tmp')) continue;
        if (entry.isSymbolicLink()) continue;
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
        if (isSensitiveWorkspacePath(relative)) continue;
        if (entry.isDirectory()) walk(absolute);
        else results.push(relative);
      }
    };
    walk(path.resolve(this.workspaceRoot));
    return results.sort();
  }

  private isGenerated(file: string): boolean { return /(^|\/)(generated|gen|vendor|fixtures?)\//i.test(file) || /\.generated\.|\.min\./i.test(file); }

  private isIndexable(file: string): boolean {
    return /\.(?:c|cc|cpp|cxx|cs|fs|fsi|fsx|go|h|hh|hpp|hxx|java|js|jsx|kt|kts|lua|m|mm|mjs|py|pyi|rs|sh|swift|ts|tsx|bash)$/i.test(file)
      || /(^|\/)(?:Dockerfile|Makefile|CMakeLists\.txt)$/i.test(file);
  }

  private isBinary(file: string): boolean {
    try { return fs.readFileSync(file).subarray(0, 4096).includes(0); } catch { return true; }
  }

  private version(files: string[]): string { return `${files.length}:${files.join('|').length}`; }
}
