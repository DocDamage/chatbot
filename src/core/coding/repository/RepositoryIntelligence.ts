import * as fs from 'fs';
import * as path from 'path';
import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { ProjectRootDetector, ProjectRoot } from './ProjectRootDetector';
import { WorkspaceInstruction, WorkspaceInstructionResolver } from './WorkspaceInstructionResolver';
import { ManifestDetector, ManifestRecord } from './ManifestDetector';
import { BuildCommandPlan, BuildSystemDetector } from './BuildSystemDetector';
import { SymbolIndex } from '../index/SymbolIndex';
import { RelationshipStore, CodeRelationship } from '../index/RelationshipStore';

export interface RepositoryFile { path: string; size: number; language?: string; generated: boolean; binary: boolean; }
export interface RepositorySnapshot { version: string; root: string; files: RepositoryFile[]; projectRoots: ProjectRoot[]; instructions: WorkspaceInstruction[]; manifests: ManifestRecord[]; languages: ReturnType<LanguageCapabilityRegistry['detect']>; buildSystems: string[]; commandPlans: BuildCommandPlan[]; relationships: CodeRelationship[]; }

const IGNORED = new Set(['node_modules', '.git', 'dist', 'coverage', 'build', '.next', '.venv', 'target']);

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
    const index = new SymbolIndex(this.workspaceRoot);
    index.indexFiles(files.filter(file => !file.binary).map(file => file.path));
    const relationships = new RelationshipStore(this.workspaceRoot);
    relationships.build(files.filter(file => !file.binary).map(file => file.path), index.all());
    return { version: this.version(names), root: path.resolve(this.workspaceRoot), files, projectRoots, instructions, manifests, languages, buildSystems: build.systems, commandPlans: build.commands, relationships: relationships.all() };
  }

  private listFiles(): string[] {
    const results: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (IGNORED.has(entry.name) || entry.name.startsWith('.tmp')) continue;
        if (entry.isSymbolicLink()) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else results.push(path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/'));
      }
    };
    walk(path.resolve(this.workspaceRoot));
    return results.sort();
  }

  private isGenerated(file: string): boolean { return /(^|\/)(generated|gen|vendor|fixtures?)\//i.test(file) || /\.generated\.|\.min\./i.test(file); }

  private isBinary(file: string): boolean {
    try { return fs.readFileSync(file).subarray(0, 4096).includes(0); } catch { return true; }
  }

  private version(files: string[]): string { return `${files.length}:${files.join('|').length}`; }
}
