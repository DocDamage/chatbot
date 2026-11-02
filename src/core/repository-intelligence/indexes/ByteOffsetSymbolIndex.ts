/**
 * Byte-Offset Symbol Index & O(1) Source Retrieval Engine (PX-04 / PX04-T01)
 *
 * Provides exact byte-offset and byte-length symbol indexing with cryptographic
 * file-digest validation, preventing stale-offset reads from returning corrupt or
 * misaligned code snippets.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface ByteOffsetSymbol {
  id: string;
  name: string;
  kind: 'class' | 'function' | 'method' | 'interface' | 'type' | 'module' | 'struct' | 'enum' | 'variable' | 'constant';
  filePath: string;
  fileDigest: string;
  byteOffset: number;
  byteLength: number;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  signature?: string;
  docComment?: string;
  scope?: string;
  exported: boolean;
}

export interface SymbolLookupQuery {
  name?: string;
  filePath?: string;
  kind?: string;
  exactMatch?: boolean;
  limit?: number;
}

export class StaleOffsetError extends Error {
  constructor(filePath: string, expectedDigest: string, actualDigest: string) {
    super(`Stale offset detected for '${filePath}': expected file digest ${expectedDigest.slice(0, 8)} but found ${actualDigest.slice(0, 8)}. Re-indexing required.`);
    this.name = 'StaleOffsetError';
  }
}

export class ByteOffsetSymbolIndex {
  private symbolsById = new Map<string, ByteOffsetSymbol>();
  private symbolsByFile = new Map<string, ByteOffsetSymbol[]>();
  private symbolsByName = new Map<string, ByteOffsetSymbol[]>();
  private fileDigests = new Map<string, string>();

  constructor(private readonly workspaceRoot: string) {}

  /**
   * Generates a unique stable symbol ID based on file path, symbol name, kind, and scope.
   */
  public static generateSymbolId(filePath: string, name: string, kind: string, scope?: string): string {
    const raw = `${filePath.replace(/\\/g, '/')}:${scope ? scope + '.' : ''}${name}#${kind}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 24);
  }

  /**
   * Index symbols with exact byte offsets for a given file content.
   */
  public indexFileContent(filePath: string, content: string, symbols: Omit<ByteOffsetSymbol, 'id' | 'filePath' | 'fileDigest'>[]): ByteOffsetSymbol[] {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const fileDigest = createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
    this.fileDigests.set(normalizedPath, fileDigest);

    // Remove old symbols for this file
    const oldSymbols = this.symbolsByFile.get(normalizedPath) || [];
    for (const old of oldSymbols) {
      this.symbolsById.delete(old.id);
      const nameList = this.symbolsByName.get(old.name);
      if (nameList) {
        this.symbolsByName.set(old.name, nameList.filter(s => s.id !== old.id));
      }
    }

    const indexedSymbols: ByteOffsetSymbol[] = symbols.map(s => {
      const id = ByteOffsetSymbolIndex.generateSymbolId(normalizedPath, s.name, s.kind, s.scope);
      return {
        ...s,
        id,
        filePath: normalizedPath,
        fileDigest
      };
    });

    this.symbolsByFile.set(normalizedPath, indexedSymbols);
    for (const symbol of indexedSymbols) {
      this.symbolsById.set(symbol.id, symbol);
      const list = this.symbolsByName.get(symbol.name) || [];
      list.push(symbol);
      this.symbolsByName.set(symbol.name, list);
    }

    return indexedSymbols;
  }

  /**
   * Perform O(1) byte-slice retrieval of the exact source text of a symbol.
   * Validates the current file digest against the indexed digest to prevent stale reads.
   */
  public retrieveSymbolSource(symbolId: string): { symbol: ByteOffsetSymbol; sourceCode: string } {
    const symbol = this.symbolsById.get(symbolId);
    if (!symbol) {
      throw new Error(`Symbol with ID '${symbolId}' not found in index`);
    }

    const fullPath = path.isAbsolute(symbol.filePath) ? symbol.filePath : path.join(this.workspaceRoot, symbol.filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Source file '${symbol.filePath}' no longer exists`);
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const currentDigest = createHash('sha256').update(fileBuffer).digest('hex');

    if (currentDigest !== symbol.fileDigest) {
      throw new StaleOffsetError(symbol.filePath, symbol.fileDigest, currentDigest);
    }

    if (symbol.byteOffset + symbol.byteLength > fileBuffer.length) {
      throw new Error(`Symbol offset range [${symbol.byteOffset}, ${symbol.byteOffset + symbol.byteLength}] exceeds file size (${fileBuffer.length} bytes)`);
    }

    const sourceSlice = fileBuffer.subarray(symbol.byteOffset, symbol.byteOffset + symbol.byteLength).toString('utf8');
    return { symbol, sourceCode: sourceSlice };
  }

  /**
   * Batch retrieve symbol sources by ID.
   */
  public batchRetrieve(symbolIds: string[]): Array<{ symbolId: string; success: boolean; sourceCode?: string; error?: string }> {
    return symbolIds.map(id => {
      try {
        const { sourceCode } = this.retrieveSymbolSource(id);
        return { symbolId: id, success: true, sourceCode };
      } catch (err: any) {
        return { symbolId: id, success: false, error: err.message };
      }
    });
  }

  /**
   * Search for symbols by query criteria.
   */
  public findSymbols(query: SymbolLookupQuery): ByteOffsetSymbol[] {
    let results: ByteOffsetSymbol[] = [];

    if (query.name) {
      if (query.exactMatch) {
        results = this.symbolsByName.get(query.name) || [];
      } else {
        const lower = query.name.toLowerCase();
        for (const [name, syms] of this.symbolsByName.entries()) {
          if (name.toLowerCase().includes(lower)) {
            results.push(...syms);
          }
        }
      }
    } else if (query.filePath) {
      const normalized = query.filePath.replace(/\\/g, '/').replace(/^\.\//, '');
      results = this.symbolsByFile.get(normalized) || [];
    } else {
      results = Array.from(this.symbolsById.values());
    }

    if (query.filePath && query.name) {
      const normalized = query.filePath.replace(/\\/g, '/').replace(/^\.\//, '');
      results = results.filter(s => s.filePath === normalized);
    }

    if (query.kind) {
      results = results.filter(s => s.kind === query.kind);
    }

    if (query.limit && query.limit > 0) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  public getSymbol(id: string): ByteOffsetSymbol | undefined {
    return this.symbolsById.get(id);
  }

  public getAllSymbols(): ByteOffsetSymbol[] {
    return Array.from(this.symbolsById.values());
  }

  public getFileSymbols(filePath: string): ByteOffsetSymbol[] {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    return this.symbolsByFile.get(normalized) || [];
  }

  public clear(): void {
    this.symbolsById.clear();
    this.symbolsByFile.clear();
    this.symbolsByName.clear();
    this.fileDigests.clear();
  }
}
