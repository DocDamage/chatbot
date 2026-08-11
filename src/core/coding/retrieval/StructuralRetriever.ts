import * as fs from 'fs';
import * as path from 'path';
import { ContextEvidence } from '../types';
import { RepositorySnapshot } from '../repository/RepositoryIntelligence';
import { SymbolIndex } from '../index/SymbolIndex';

export interface RetrievalRequest { query: string; files?: string[]; symbols?: string[]; diagnostics?: Array<{ file?: string; message: string }>; maxItems?: number; }

export class StructuralRetriever {
  constructor(private readonly workspaceRoot: string, private readonly snapshot: RepositorySnapshot, private readonly index: SymbolIndex) {}

  retrieve(request: RetrievalRequest): ContextEvidence[] {
    const maxItems = request.maxItems || 24;
    const results: ContextEvidence[] = [];
    const addFile = (file: string, kind: ContextEvidence['kind'], reason: string, confidence: number) => {
      if (results.some(item => item.path === file)) return;
      try {
        const record = this.snapshot.files.find(item => item.path === file);
        if (!record || record.binary) return;
        const content = fs.readFileSync(path.resolve(this.workspaceRoot, file), 'utf8').slice(0, 24000);
        results.push({ kind, label: file, content, path: file, authority: 'repository', reason, confidence });
      } catch { /* files can disappear between snapshot and retrieval */ }
    };
    for (const file of request.files || []) addFile(file, 'source', 'user-mentioned path', 1);
    for (const diagnostic of request.diagnostics || []) if (diagnostic.file) addFile(diagnostic.file, 'diagnostic', `diagnostic: ${diagnostic.message}`, 1);
    for (const symbol of request.symbols || []) {
      for (const match of this.index.findDefinitions(symbol)) addFile(match.file, 'symbol', `definition of ${symbol}`, match.confidence);
      for (const match of this.index.findReferences(symbol).slice(0, 5)) addFile(match.file, 'symbol', `reference to ${symbol}`, match.confidence * 0.85);
    }
    for (const instruction of this.snapshot.instructions) results.push({ kind: 'instruction', label: instruction.path, content: instruction.content, path: instruction.path, authority: 'repository', reason: 'applicable repository instruction', confidence: 1 });
    for (const file of this.snapshot.files.filter(item => this.isTest(item.path)).slice(0, 5)) addFile(file.path, 'test', 'related test convention', 0.65);
    const terms = request.query.toLowerCase().split(/[^a-z0-9_$-]+/).filter(term => term.length > 2);
    for (const file of this.snapshot.files) {
      if (results.length >= maxItems) break;
      const score = terms.filter(term => file.path.toLowerCase().includes(term)).length;
      if (score) addFile(file.path, 'source', `path matches request (${score} term${score === 1 ? '' : 's'})`, Math.min(0.8, score / terms.length));
    }
    return results.sort((a, b) => b.confidence - a.confidence).slice(0, maxItems);
  }

  private isTest(file: string): boolean { return /(^|\/)(__tests__|tests?)(\/|$)|\.(test|spec)\./i.test(file); }
}
