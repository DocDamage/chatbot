import * as fs from 'fs';
import * as path from 'path';
import { FallbackParserProvider } from './FallbackParserProvider';
import { IndexedSymbol, ParserProvider } from './ParserProvider';
import { TreeSitterParserProvider } from './TreeSitterParserProvider';
import { TypeScriptParserProvider } from './TypeScriptParserProvider';

export class SymbolIndex {
  private readonly providers: ParserProvider[];
  private readonly symbols = new Map<string, IndexedSymbol[]>();
  constructor(private readonly workspaceRoot: string, providers: ParserProvider[] = []) { this.providers = [...providers, new TypeScriptParserProvider(), new TreeSitterParserProvider(), new FallbackParserProvider()]; }

  indexFile(file: string): IndexedSymbol[] {
    const absolute = path.resolve(this.workspaceRoot, file);
    const relative = path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
    if (relative.startsWith('..') || !fs.existsSync(absolute)) throw new Error(`File is outside or missing: ${file}`);
    const content = fs.readFileSync(absolute, 'utf8');
    const provider = this.providers.find(candidate => candidate.supports(relative));
    const result = provider ? provider.parse(relative, content) : [];
    this.symbols.set(relative, result);
    return result;
  }

  indexFiles(files: string[]): void { files.forEach(file => { try { this.indexFile(file); } catch { /* stale/deleted files are skipped during an incremental rebuild */ } }); }
  getFileSymbols(file: string): IndexedSymbol[] { return this.symbols.get(file.replace(/\\/g, '/')) || this.indexFile(file); }
  all(): IndexedSymbol[] { return [...this.symbols.values()].flat(); }
  findDefinitions(name: string): IndexedSymbol[] { return this.all().filter(symbol => symbol.name === name && !['import', 'export'].includes(symbol.kind)); }
  findReferences(name: string): IndexedSymbol[] { return this.all().filter(symbol => symbol.name.includes(name)); }
}
