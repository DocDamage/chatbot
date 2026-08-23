import { IndexedSymbol } from '../index/ParserProvider';
import { ArchitectureCacheStats, SymbolAnalysisResult } from './ArchitectureTypes';
import { normalizeRepositoryPath } from './ArchitectureIdentity';

interface CacheEntry {
  parser: string;
  symbols: IndexedSymbol[];
}

export class RepositoryArchitectureCache {
  private readonly entries = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;

  constructor(private readonly maxEntries = 5000) {}

  get(parserVersion: string, file: string, digest: string): SymbolAnalysisResult | undefined {
    const key = this.key(parserVersion, file, digest);
    const value = this.entries.get(key);
    if (!value) {
      this.missCount += 1;
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, value);
    this.hitCount += 1;
    return this.clone(value);
  }

  set(parserVersion: string, file: string, digest: string, value: SymbolAnalysisResult): void {
    const key = this.key(parserVersion, file, digest);
    this.entries.delete(key);
    this.entries.set(key, this.clone(value));
    while (this.entries.size > Math.max(1, this.maxEntries)) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }

  stats(parserVersion: string): ArchitectureCacheStats {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      entries: this.entries.size,
      parserVersion
    };
  }

  clear(): void {
    this.entries.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  private key(parserVersion: string, file: string, digest: string): string {
    return `${parserVersion}\0${normalizeRepositoryPath(file)}\0${digest}`;
  }

  private clone(value: CacheEntry): SymbolAnalysisResult {
    return { parser: value.parser, symbols: value.symbols.map(symbol => ({ ...symbol })) };
  }
}
