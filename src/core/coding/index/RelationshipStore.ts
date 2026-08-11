import * as fs from 'fs';
import * as path from 'path';
import { IndexedSymbol } from './ParserProvider';

export type RelationshipKind = 'imports' | 'references' | 'implements' | 'tests' | 'callers' | 'depends_on';
export interface CodeRelationship { from: string; to: string; kind: RelationshipKind; confidence: number; line?: number; }

export class RelationshipStore {
  private readonly relationships: CodeRelationship[] = [];
  constructor(private readonly workspaceRoot: string) {}

  build(files: string[], symbols: IndexedSymbol[]): void {
    this.relationships.length = 0;
    const knownFiles = new Set(files.map(file => file.replace(/\\/g, '/')));
    const definitions = symbols.filter(symbol => !['import', 'export', 'test'].includes(symbol.kind));
    const definitionsByName = new Map<string, IndexedSymbol[]>();
    for (const definition of definitions) {
      const matches = definitionsByName.get(definition.name) || [];
      matches.push(definition);
      definitionsByName.set(definition.name, matches);
    }
    const add = (relationship: CodeRelationship) => {
      const duplicate = this.relationships.some(existing => existing.from === relationship.from && existing.to === relationship.to && existing.kind === relationship.kind && existing.line === relationship.line);
      if (!duplicate) this.relationships.push(relationship);
    };
    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(path.resolve(this.workspaceRoot, file), 'utf8'); } catch { continue; }
      content.split(/\r?\n/).forEach((line, index) => {
        const imported = line.match(/(?:import\s+.*?\s+from\s+|from\s+|#include\s*[<"]|require\s*\(\s*|using\s+|use\s+)[<("']?([^)>'"\s;]+)/i)?.[1];
        if (imported) {
          add({ from: file, to: imported, kind: 'imports', confidence: 0.7, line: index + 1 });
          const resolved = this.resolveImport(file, imported, knownFiles);
          if (resolved) add({ from: file, to: resolved, kind: 'depends_on', confidence: 0.9, line: index + 1 });
        }
        const tested = line.match(/\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)/i)?.[1];
        if (tested) add({ from: file, to: tested, kind: 'tests', confidence: 0.6, line: index + 1 });
        const identifiers = new Set(line.match(/[A-Za-z_$][\\w$]*/g) || []);
        for (const identifier of identifiers) {
          const matches = definitionsByName.get(identifier) || [];
          if (!matches.length || identifier.length < 2) continue;
          const calling = new RegExp(`\\b${this.escapeRegExp(identifier)}\\s*\\(`).test(line);
          for (const definition of matches) {
            if (definition.file === file) continue;
            add({ from: file, to: definition.file, kind: calling ? 'callers' : 'references', confidence: Math.min(0.9, definition.confidence), line: index + 1 });
          }
        }
        const implementation = line.match(/(?:\b(?:implements|extends)\s+|\bclass\s+\w+\s*\(\s*|:\s*)([A-Za-z_$][\w$]*)/i)?.[1];
        if (implementation) {
          const target = (definitionsByName.get(implementation) || []).find(definition => definition.file !== file);
          if (target) add({ from: file, to: target.file, kind: 'implements', confidence: 0.82, line: index + 1 });
        }
      });
    }
    for (const symbol of symbols.filter(candidate => candidate.kind === 'test')) {
      const target = definitions.find(definition => symbol.name.toLowerCase().includes(definition.name.toLowerCase()));
      if (target) add({ from: symbol.file, to: target.file, kind: 'tests', confidence: Math.min(0.85, symbol.confidence), line: symbol.line });
    }
  }

  query(kind: RelationshipKind, target?: string): CodeRelationship[] { return this.relationships.filter(relationship => relationship.kind === kind && (!target || relationship.from === target || relationship.to === target)); }
  all(): CodeRelationship[] { return [...this.relationships]; }

  private resolveImport(from: string, imported: string, knownFiles: Set<string>): string | undefined {
    if (!imported.startsWith('.') && !imported.startsWith('/')) return undefined;
    const importPath = imported.startsWith('.') && !imported.startsWith('./') && !imported.startsWith('../') ? `./${imported.slice(1)}` : imported;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from.replace(/\\/g, '/')), importPath.replace(/\\/g, '/'))).replace(/^\.\//, '');
    const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.h', '.cpp', '.hpp'].map(extension => `${base}${extension}`), `${base}/index.ts`, `${base}/index.js`, `${base}/__init__.py`];
    return candidates.find(candidate => knownFiles.has(candidate));
  }

  private escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
}
