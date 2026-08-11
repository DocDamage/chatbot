import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CodeIndexer, CodeSymbol } from '../agents/CodeIndexer';
import { ProjectContext, ProjectInfo } from '../memory/ProjectContext';

export interface ProjectFileInsight {
  path: string;
  lines: number;
  symbols: number;
  complexity: number;
  churn: number;
  risk: number;
  recommendation?: string;
}

export interface ProjectIntelligenceOverview {
  project: Pick<ProjectInfo, 'name' | 'description' | 'type' | 'language' | 'frameworks' | 'keyFiles' | 'conventions' | 'loadedAt'>;
  summary: { files: number; lines: number; symbols: number; churnedFiles: number; averageRisk: number };
  hotspots: ProjectFileInsight[];
  duplicateCandidates: Array<{ signature: string; files: string[] }>;
  recommendations: string[];
}

export class ProjectIntelligenceService {
  private readonly projectContext: ProjectContext;
  private readonly codeIndexer: CodeIndexer;
  private readonly ignored = new Set(['.git', '.next', '.vite', '.remembrandt', 'cache', 'coverage', 'data', 'dist', 'node_modules', 'logs', 'tmp']);

  constructor(private readonly workspaceRoot = process.cwd()) {
    this.projectContext = new ProjectContext(workspaceRoot);
    this.codeIndexer = new CodeIndexer(workspaceRoot);
  }

  async overview(maxFiles = 250): Promise<ProjectIntelligenceOverview> {
    const context = await this.projectContext.load();
    const churn = this.gitChurn();
    const files = this.walk().filter(file => /\.(ts|tsx|js|jsx|py|rs|go|java|md)$/.test(file)).slice(0, Math.min(Math.max(maxFiles, 1), 500));
    const insights = files.map(file => this.inspectFile(file, churn));
    const hotspots = insights.sort((a, b) => b.risk - a.risk || b.churn - a.churn).slice(0, 25);
    const duplicateCandidates = this.findDuplicateCandidates(files);
    const averageRisk = insights.length === 0 ? 0 : Number((insights.reduce((sum, item) => sum + item.risk, 0) / insights.length).toFixed(2));
    const recommendations = this.recommend(hotspots, duplicateCandidates);

    return {
      project: {
        name: context.name,
        description: context.description,
        type: context.type,
        language: context.language,
        frameworks: context.frameworks,
        keyFiles: context.keyFiles,
        conventions: context.conventions,
        loadedAt: context.loadedAt
      },
      summary: {
        files: insights.length,
        lines: insights.reduce((sum, item) => sum + item.lines, 0),
        symbols: insights.reduce((sum, item) => sum + item.symbols, 0),
        churnedFiles: insights.filter(item => item.churn > 0).length,
        averageRisk
      },
      hotspots,
      duplicateCandidates,
      recommendations
    };
  }

  inspect(relativePath: string): ProjectFileInsight & { symbolDetails: CodeSymbol[] } {
    const absolute = this.resolve(relativePath);
    const churn = this.gitChurn();
    const insight = this.inspectFile(absolute, churn);
    return { ...insight, symbolDetails: this.codeIndexer.getFileSymbols(relativePath).slice(0, 250) };
  }

  history(limit = 20): Array<{ hash: string; subject: string; author: string; date: string }> {
    const result = spawnSync('git', ['log', `-${Math.min(Math.max(limit, 1), 100)}`, '--date=iso-strict', '--format=%H%x09%an%x09%ad%x09%s'], {
      cwd: this.workspaceRoot,
      encoding: 'utf8',
      windowsHide: true
    });
    if (result.status !== 0) return [];
    return String(result.stdout || '').split(/\r?\n/).filter(Boolean).map(line => {
      const [hash, author, date, ...subject] = line.split('\t');
      return { hash, author, date, subject: subject.join('\t') };
    });
  }

  private inspectFile(absolute: string, churn: Map<string, number>): ProjectFileInsight {
    const content = fs.readFileSync(absolute, 'utf8');
    const relative = path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
    const lines = content.split(/\r?\n/).length;
    const symbols = /\.(ts|tsx|js|jsx)$/.test(absolute) ? this.codeIndexer.getFileSymbols(relative).length : 0;
    const complexity = (content.match(/\b(if|for|while|case|catch)\b|&&|\|\|/g) || []).length;
    const fileChurn = churn.get(relative) || 0;
    const risk = Number(Math.min(100, lines / 20 + complexity * 1.5 + fileChurn * 0.8).toFixed(2));
    return {
      path: relative,
      lines,
      symbols,
      complexity,
      churn: fileChurn,
      risk,
      recommendation: risk >= 60 ? 'Split or add focused tests before changing this hotspot.' : risk >= 30 ? 'Prefer small changes and review nearby callers.' : undefined
    };
  }

  private findDuplicateCandidates(files: string[]): Array<{ signature: string; files: string[] }> {
    const locations = new Map<string, Set<string>>();
    for (const file of files.filter(item => /\.(ts|tsx|js|jsx)$/.test(item))) {
      const relative = path.relative(this.workspaceRoot, file).replace(/\\/g, '/');
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const signature = line.replace(/\s+/g, ' ').trim();
        if (signature.length < 45 || signature.startsWith('//') || signature.startsWith('*')) continue;
        const set = locations.get(signature) || new Set<string>();
        set.add(relative);
        locations.set(signature, set);
      }
    }
    return Array.from(locations.entries())
      .filter(([, filesForLine]) => filesForLine.size > 1)
      .slice(0, 20)
      .map(([signature, filesForLine]) => ({ signature, files: Array.from(filesForLine).sort() }));
  }

  private recommend(hotspots: ProjectFileInsight[], duplicates: Array<{ files: string[] }>): string[] {
    const recommendations: string[] = [];
    if (hotspots.some(item => item.risk >= 60)) recommendations.push('Review the highest-risk hotspots before adding new behavior.');
    if (duplicates.length > 0) recommendations.push('Compare repeated code signatures and extract shared behavior where the boundaries are stable.');
    if (hotspots.some(item => item.churn >= 8)) recommendations.push('Add regression tests around high-churn files before refactoring them.');
    if (recommendations.length === 0) recommendations.push('No immediate hotspot was detected; keep the project map refreshed after structural changes.');
    return recommendations;
  }

  private gitChurn(): Map<string, number> {
    const result = spawnSync('git', ['log', '-n', '300', '--format=', '--name-only'], { cwd: this.workspaceRoot, encoding: 'utf8', windowsHide: true });
    const churn = new Map<string, number>();
    if (result.status !== 0) return churn;
    for (const line of String(result.stdout || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
      churn.set(line.replace(/\\/g, '/'), (churn.get(line.replace(/\\/g, '/')) || 0) + 1);
    }
    return churn;
  }

  private walk(dir = this.workspaceRoot): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !this.ignored.has(entry.name)) files.push(...this.walk(path.join(dir, entry.name)));
      else if (entry.isFile()) files.push(path.join(dir, entry.name));
    }
    return files;
  }

  private resolve(relativePath: string): string {
    const absolute = path.resolve(this.workspaceRoot, relativePath);
    const relative = path.relative(this.workspaceRoot, absolute);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('File must be inside the workspace');
    return absolute;
  }
}
