import { ApprovedRepositoryGateway, RepositoryAccessError } from '../security/ApprovedRepositoryGateway';
import { FallbackParserProvider } from './FallbackParserProvider';
import { IndexedSymbol, ParserProvider } from './ParserProvider';
import { TreeSitterParserProvider } from './TreeSitterParserProvider';
import { TypeScriptParserProvider } from './TypeScriptParserProvider';

export class SymbolIndex {
  private readonly providers: ParserProvider[];
  private readonly symbols = new Map<string, IndexedSymbol[]>();
  private readonly repository: ApprovedRepositoryGateway;

  constructor(
    workspaceRoot: string,
    providers: ParserProvider[] = [],
    repository?: ApprovedRepositoryGateway
  ) {
    this.providers = [
      ...providers,
      new TypeScriptParserProvider(),
      new TreeSitterParserProvider(),
      new FallbackParserProvider()
    ];
    this.repository = repository || new ApprovedRepositoryGateway(workspaceRoot, {
      maxReadBytes: 2 * 1024 * 1024
    });
  }

  indexFile(file: string): IndexedSymbol[] {
    const source = this.repository.readTextFile(file, 2 * 1024 * 1024);
    if (source.truncated) {
      throw new RepositoryAccessError('LIMIT_EXCEEDED', `Source file exceeds the indexing limit: ${file}`);
    }
    const provider = this.providers.find(candidate => candidate.supports(source.path));
    const result = provider ? provider.parse(source.path, source.content) : [];
    this.symbols.set(source.path, result);
    return result;
  }

  indexFiles(files: string[]): void {
    files.forEach(file => {
      try {
        this.indexFile(file);
      } catch {
        // Stale, denied, or deleted files are skipped during an incremental rebuild.
      }
    });
  }

  getFileSymbols(file: string): IndexedSymbol[] {
    const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
    return this.symbols.get(normalized) || this.indexFile(file);
  }

  all(): IndexedSymbol[] {
    return [...this.symbols.values()].flat();
  }

  findDefinitions(name: string): IndexedSymbol[] {
    return this.all().filter(symbol => symbol.name === name && !['import', 'export'].includes(symbol.kind));
  }

  findReferences(name: string): IndexedSymbol[] {
    return this.all().filter(symbol => symbol.name.includes(name));
  }
}
