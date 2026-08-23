import { ApprovedRepositoryGateway, RepositoryAccessError } from '../coding/security/ApprovedRepositoryGateway';

export interface CodeSymbol {
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'import' | 'export' | 'route' | 'test';
  name: string;
  file: string;
  signature?: string;
  line: number;
}

export class CodeIndexer {
  private readonly repository: ApprovedRepositoryGateway;

  constructor(workspaceRoot: string = process.cwd(), repository?: ApprovedRepositoryGateway) {
    this.repository = repository || new ApprovedRepositoryGateway(workspaceRoot, {
      maxReadBytes: 2 * 1024 * 1024
    });
  }

  getFileSymbols(filePath: string): CodeSymbol[] {
    const source = this.repository.readTextFile(filePath, 2 * 1024 * 1024);
    if (source.truncated) {
      throw new RepositoryAccessError('LIMIT_EXCEEDED', `Source file exceeds the indexing limit: ${filePath}`);
    }
    const symbols: CodeSymbol[] = [];

    source.content.split(/\r?\n/).forEach((line, index) => {
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
            file: source.path,
            signature: line.trim(),
            line: lineNumber
          });
        }
      }
    });

    return symbols;
  }
}
