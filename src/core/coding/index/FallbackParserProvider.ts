import * as path from 'path';
import { IndexedSymbol, ParserProvider } from './ParserProvider';

export class FallbackParserProvider implements ParserProvider {
  id = 'line-fallback';
  supports(_file: string): boolean { return true; }

  parse(file: string, content: string): IndexedSymbol[] {
    const extension = path.extname(file).toLowerCase();
    const symbols: IndexedSymbol[] = [];
    const patterns: Array<[IndexedSymbol['kind'], RegExp]> = [
      ['class', /\b(?:export\s+)?class\s+([\w$]+)/], ['interface', /\b(?:export\s+)?interface\s+([\w$]+)/], ['type', /\b(?:export\s+)?type\s+([\w$]+)/],
      ['function', /\b(?:export\s+)?(?:async\s+)?function\s+([\w$]+)/], ['struct', /\bstruct\s+([\w$]+)/], ['enum', /\benum\s+([\w$]+)/],
      ['function', /\bfunc\s+(?:\([^)]*\)\s*)?([\w$]+)/], ['function', /\b(?:def|fn)\s+([\w$]+)/], ['function', /\b(?:public|private|protected)?\s*(?:static\s+)?[\w<>?\[\]]+\s+([\w$]+)\s*\([^;]*\)\s*\{/],
      ['import', /^\s*(?:import|using|require|#include|from)\s+(.+)/], ['export', /^\s*export\s+(.+)/], ['route', /\b(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/], ['test', /\b(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/]
    ];
    content.split(/\r?\n/).forEach((line, index) => {
      for (const [kind, pattern] of patterns) {
        const match = line.match(pattern);
        if (!match) continue;
        const name = kind === 'route' ? `${match[1]} ${match[2]}` : kind === 'import' || kind === 'export' ? match[1].trim() : match[1];
        if (name) symbols.push({ kind, name, file: file.replace(/\\/g, '/'), line: index + 1, column: match.index === undefined ? undefined : match.index + 1, signature: line.trim(), confidence: extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.jsx' ? 0.7 : 0.55, parser: this.id });
      }
    });
    return symbols;
  }
}
