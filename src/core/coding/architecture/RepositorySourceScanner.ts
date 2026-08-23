import { LanguageCapabilityRegistry } from '../languages/LanguageCapabilityRegistry';
import { SymbolIndex } from '../index/SymbolIndex';
import { ApprovedRepositoryGateway, RepositoryAccessError } from '../security/ApprovedRepositoryGateway';
import {
  ArchitectureCacheStats,
  ArchitectureLimits,
  ArchitectureParserHealth,
  ArchitectureSymbolIndexer,
  ArchitectureWarning,
  ScannedArchitectureFile
} from './ArchitectureTypes';
import { contentDigest } from './ArchitectureIdentity';
import { isGeneratedPath, isIndexablePath } from './ArchitectureDetectors';
import { RepositoryArchitectureCache } from './RepositoryArchitectureCache';

export interface RepositoryScanResult {
  files: ScannedArchitectureFile[];
  warnings: ArchitectureWarning[];
  parserHealth: ArchitectureParserHealth[];
  filesDiscovered: number;
  generatedFilesSkipped: number;
  binaryFilesSkipped: number;
  bytesRead: number;
  truncated: boolean;
  cache: ArchitectureCacheStats;
}

export interface RepositorySourceScannerDependencies {
  repository?: ApprovedRepositoryGateway;
  indexer?: ArchitectureSymbolIndexer;
  cache?: RepositoryArchitectureCache;
  registry?: LanguageCapabilityRegistry;
}

export class RepositorySourceScanner {
  private readonly repository: ApprovedRepositoryGateway;
  private readonly indexer: ArchitectureSymbolIndexer;
  private readonly cache: RepositoryArchitectureCache;
  private readonly registry: LanguageCapabilityRegistry;

  constructor(
    workspaceRoot: string,
    private readonly limits: ArchitectureLimits,
    dependencies: RepositorySourceScannerDependencies = {}
  ) {
    const scanLimit = Math.min(20_000, Math.max(limits.maxFiles + 1, limits.maxFiles * 4 + 1));
    this.repository = dependencies.repository || new ApprovedRepositoryGateway(workspaceRoot, {
      maxFiles: scanLimit,
      maxReadBytes: limits.maxFileBytes
    });
    this.indexer = dependencies.indexer || new SymbolIndex(workspaceRoot, [], this.repository);
    this.cache = dependencies.cache || new RepositoryArchitectureCache();
    this.registry = dependencies.registry || new LanguageCapabilityRegistry();
  }

  scan(): RepositoryScanResult {
    const warnings: ArchitectureWarning[] = [];
    const scanLimit = Math.min(20_000, Math.max(this.limits.maxFiles + 1, this.limits.maxFiles * 4 + 1));
    const listed = this.repository.listFiles('.', scanLimit).sort();
    const files: ScannedArchitectureFile[] = [];
    const parserGroups = new Map<string, { files: number; symbols: number; confidence: number; failures: number }>();
    let generatedFilesSkipped = 0;
    let binaryFilesSkipped = 0;
    let bytesRead = 0;
    let symbolCount = 0;
    let truncated = listed.length >= scanLimit;
    let symbolLimitReported = false;

    if (truncated) warnings.push({
      code: 'DISCOVERY_LIMIT_REACHED',
      message: `Repository discovery stopped after ${scanLimit} files.`
    });

    for (const file of listed) {
      if (files.length >= this.limits.maxFiles) {
        warnings.push({ code: 'FILE_LIMIT_REACHED', message: `Only ${this.limits.maxFiles} repository files were analyzed.` });
        truncated = true;
        break;
      }
      if (this.pathDepth(file) > this.limits.maxPathDepth) {
        warnings.push({ code: 'PATH_DEPTH_LIMIT_REACHED', message: `File exceeds the ${this.limits.maxPathDepth}-segment path limit.`, file });
        truncated = true;
        continue;
      }
      const generated = isGeneratedPath(file);
      if (generated && !this.limits.includeGenerated) {
        generatedFilesSkipped += 1;
        continue;
      }

      let metadata: ReturnType<ApprovedRepositoryGateway['describePath']>;
      try {
        metadata = this.repository.describePath(file);
      } catch (error) {
        warnings.push({ code: 'FILE_METADATA_FAILED', message: this.message(error), file });
        continue;
      }
      const base: ScannedArchitectureFile = {
        path: metadata.path,
        size: metadata.size,
        digest: contentDigest(`${metadata.path}:${metadata.size}`),
        generated,
        binary: false,
        parsed: false,
        symbols: []
      };
      if (metadata.size > this.limits.maxFileBytes) {
        warnings.push({ code: 'FILE_TOO_LARGE', message: `File exceeds the ${this.limits.maxFileBytes}-byte analysis limit.`, file });
        files.push(base);
        truncated = true;
        continue;
      }
      if (bytesRead + metadata.size > this.limits.maxTotalBytes) {
        warnings.push({ code: 'TOTAL_BYTES_LIMIT_REACHED', message: `The ${this.limits.maxTotalBytes}-byte repository analysis budget was reached.`, file });
        truncated = true;
        break;
      }

      try {
        const read = this.repository.readTextFile(file, this.limits.maxFileBytes);
        if (read.truncated) {
          warnings.push({ code: 'FILE_TOO_LARGE', message: `File exceeds the ${this.limits.maxFileBytes}-byte analysis limit.`, file });
          files.push(base);
          truncated = true;
          continue;
        }
        bytesRead += read.size;
        const language = this.registry.detect([read.path]).languages[0]?.language;
        const scanned: ScannedArchitectureFile = {
          ...base,
          path: read.path,
          digest: contentDigest(read.content),
          language,
          content: read.content
        };
        if (isIndexablePath(read.path)) {
          const cached = this.cache.get(this.indexer.parserVersion, read.path, scanned.digest);
          const analysis = cached || this.indexer.indexContentWithReport(read.path, read.content);
          if (!cached) this.cache.set(this.indexer.parserVersion, read.path, scanned.digest, analysis);
          const remaining = Math.max(0, this.limits.maxSymbols - symbolCount);
          scanned.symbols = analysis.symbols.slice(0, remaining);
          scanned.parser = analysis.parser;
          scanned.parsed = true;
          symbolCount += scanned.symbols.length;
          if (analysis.symbols.length > remaining && !symbolLimitReported) {
            warnings.push({ code: 'SYMBOL_LIMIT_REACHED', message: `Architecture symbol limit ${this.limits.maxSymbols} was reached.` });
            symbolLimitReported = true;
            truncated = true;
          }
          this.recordParserHealth(parserGroups, analysis.parser, scanned.symbols);
        }
        files.push(scanned);
      } catch (error) {
        if (error instanceof RepositoryAccessError && error.code === 'BINARY_FILE') {
          binaryFilesSkipped += 1;
          files.push({ ...base, binary: true });
          warnings.push({ code: 'BINARY_FILE_SKIPPED', message: 'Binary content was not read by the static analyzer.', file });
          continue;
        }
        warnings.push({ code: 'FILE_READ_FAILED', message: this.message(error), file });
        files.push(base);
      }
    }

    return {
      files,
      warnings,
      parserHealth: this.renderParserHealth(parserGroups),
      filesDiscovered: listed.length,
      generatedFilesSkipped,
      binaryFilesSkipped,
      bytesRead,
      truncated,
      cache: this.cache.stats(this.indexer.parserVersion)
    };
  }

  get approvedRoot(): string {
    return this.repository.approvedRoot;
  }

  clearCache(): void {
    this.cache.clear();
  }

  cacheStats(): ArchitectureCacheStats {
    return this.cache.stats(this.indexer.parserVersion);
  }

  private recordParserHealth(
    groups: Map<string, { files: number; symbols: number; confidence: number; failures: number }>,
    parser: string,
    symbols: ScannedArchitectureFile['symbols']
  ): void {
    const group = groups.get(parser) || { files: 0, symbols: 0, confidence: 0, failures: 0 };
    group.files += 1;
    group.symbols += symbols.length;
    group.confidence += symbols.reduce((sum, symbol) => sum + symbol.confidence, 0);
    if (parser === 'unparsed') group.failures += 1;
    groups.set(parser, group);
  }

  private renderParserHealth(
    groups: Map<string, { files: number; symbols: number; confidence: number; failures: number }>
  ): ArchitectureParserHealth[] {
    return [...groups.entries()].map(([parser, group]) => ({
      parser,
      files: group.files,
      symbols: group.symbols,
      averageConfidence: group.symbols ? group.confidence / group.symbols : 0,
      fallback: parser.includes('fallback') || parser.includes('recovery'),
      failures: group.failures
    })).sort((left, right) => left.parser.localeCompare(right.parser));
  }

  private pathDepth(file: string): number {
    return file.replace(/\\/g, '/').split('/').filter(Boolean).length;
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown repository analysis error.';
  }
}
