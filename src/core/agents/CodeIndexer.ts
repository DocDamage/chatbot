import * as fs from 'fs';
import * as path from 'path';

export interface CodeSymbol {
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'import' | 'export' | 'route' | 'test';
  name: string;
  file: string;
  signature?: string;
  line: number;
}

export class CodeIndexer {
  constructor(private readonly workspaceRoot: string = process.cwd()) {}

  getFileSymbols(filePath: string): CodeSymbol[] {
    const absolute = this.resolveInsideWorkspace(filePath);
    const content = fs.readFileSync(absolute, 'utf8');
    const relative = path.relative(this.workspaceRoot, absolute).replace(/\\/g, '/');
    const symbols: CodeSymbol[] = [];

    content.split(/\r?\n/).forEach((line, index) => {
      const lineNumber = index + 1;
      const checks: Array<[CodeSymbol['kind'], RegExp]> = [
        ['class', /\b(?:export\s+)?class\s+([A-Za-z0-9_]+)/],
        ['interface', /\b(?:export\s+)?interface\s+([A-Za-z0-9_]+)/],
        ['type', /\b(?:export\s+)?type\s+([A-Za-z0-9_]+)/],
        ['function', /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/],
        ['method', /^\s*(?:private\s+|public\s+|protected\s+)?(?:async\s+)?([A-Za-z0-9_]+)\s*\(/],
        ['import', /^\s*import\s+.*from\s+['"]([^'"]+)['"]/],
        ['export', /^\s*export\s+(?:\{([^}]+)\}|.*from\s+['"]([^'"]+)['"])/],
        ['route', /\b(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/],
        ['test', /\b(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/]
      ];

      for (const [kind, regex] of checks) {
        const match = line.match(regex);
        if (match) {
          symbols.push({
            kind,
            name: match[2] || match[1],
            file: relative,
            signature: line.trim(),
            line: lineNumber
          });
        }
      }
    });

    return symbols;
  }

  private resolveInsideWorkspace(filePath: string): string {
    const absolute = path.resolve(this.workspaceRoot, filePath);
    const relative = path.relative(this.workspaceRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path is outside the workspace: ${filePath}`);
    }
    return absolute;
  }
}
