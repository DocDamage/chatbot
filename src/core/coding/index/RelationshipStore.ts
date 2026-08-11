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
    for (const file of files) {
      let content: string;
      try { content = fs.readFileSync(path.resolve(this.workspaceRoot, file), 'utf8'); } catch { continue; }
      content.split(/\r?\n/).forEach((line, index) => {
        const imported = line.match(/(?:import\s+.*?\s+from\s+|#include\s*[<"]|require\s*\(\s*|using\s+)[<("']?([^)>"'\s;]+)/i)?.[1];
        if (imported) this.relationships.push({ from: file, to: imported, kind: 'imports', confidence: 0.7, line: index + 1 });
        const tested = line.match(/\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)/i)?.[1];
        if (tested) this.relationships.push({ from: file, to: tested, kind: 'tests', confidence: 0.6, line: index + 1 });
      });
    }
    for (const symbol of symbols) {
      const name = symbol.name;
      for (const other of symbols.filter(candidate => candidate.file !== symbol.file && candidate.name.includes(name))) this.relationships.push({ from: other.file, to: symbol.file, kind: 'references', confidence: Math.min(symbol.confidence, other.confidence) });
    }
  }

  query(kind: RelationshipKind, target?: string): CodeRelationship[] { return this.relationships.filter(relationship => relationship.kind === kind && (!target || relationship.from === target || relationship.to === target)); }
  all(): CodeRelationship[] { return [...this.relationships]; }
}
