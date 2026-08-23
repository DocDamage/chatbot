import { ArchitectureGraphCollector } from './ArchitectureGraphCollector';
import { ArchitectureFeatureCollector } from './ArchitectureFeatureCollector';
import { canonicalJson, stableHash } from './ArchitectureIdentity';
import { ArchitectureRelationshipCollector } from './ArchitectureRelationshipCollector';
import { ArchitectureStructureCollector } from './ArchitectureStructureCollector';
import {
  ArchitectureCacheStats,
  ArchitectureLimits,
  ArchitectureStats,
  ArchitectureWarning,
  CANONICAL_ARCHITECTURE_GENERATED_AT,
  REPODNA_REFERENCE_REVISION,
  REPOSITORY_ARCHITECTURE_SCHEMA_VERSION,
  RepositoryArchitectureProvider,
  RepositoryArchitectureSnapshot,
  ScannedArchitectureFile
} from './ArchitectureTypes';
import {
  RepositorySourceScanner,
  RepositorySourceScannerDependencies
} from './RepositorySourceScanner';
import { detectEntrypoints } from './ArchitectureDetectors';

export interface RepositoryArchitectureBuilderOptions extends Partial<ArchitectureLimits> {
  generatedAt?: string;
  rootName?: string;
}

const DEFAULT_LIMITS: ArchitectureLimits = {
  maxFiles: 5000,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
  maxSymbols: 100_000,
  maxEdges: 200_000,
  maxPathDepth: 64,
  maxTraversalDepth: 8,
  maxTraversalNodes: 5000,
  includeGenerated: false
};

export class RepositoryArchitectureBuilder implements RepositoryArchitectureProvider {
  private readonly limits: ArchitectureLimits;
  private readonly scanner: RepositorySourceScanner;
  private readonly generatedAt: string;
  private readonly rootName?: string;

  constructor(
    workspaceRoot: string,
    options: RepositoryArchitectureBuilderOptions = {},
    dependencies: RepositorySourceScannerDependencies = {}
  ) {
    this.limits = normalizeLimits(options);
    this.generatedAt = options.generatedAt || CANONICAL_ARCHITECTURE_GENERATED_AT;
    this.rootName = options.rootName;
    this.scanner = new RepositorySourceScanner(workspaceRoot, this.limits, dependencies);
  }

  build(): RepositoryArchitectureSnapshot {
    const scan = this.scanner.scan();
    const graph = new ArchitectureGraphCollector(this.limits.maxEdges);
    scan.warnings.forEach(warning => graph.warn(warning.code, warning.message, warning.file));
    const repositoryName = this.rootName || detectRepositoryName(scan.files);
    const structure = new ArchitectureStructureCollector().collect(scan.files, graph, repositoryName);
    const features = new ArchitectureFeatureCollector().collect(
      scan.files,
      graph,
      structure.repositoryId,
      structure.fileIds,
      structure.parentIds
    );
    new ArchitectureRelationshipCollector().collect(
      scan.files,
      graph,
      structure.fileIds,
      structure.symbolIds,
      features.testIds,
      features.dependencyIds
    );

    const nodes = graph.nodes();
    const edges = graph.edges();
    const warnings = sortWarnings(graph.warnings);
    const entrypointIds = detectEntrypoints(scan.files)
      .map(entrypoint => structure.fileIds.get(entrypoint.file))
      .filter((value): value is string => Boolean(value))
      .sort();
    const repositoryVersion = stableHash(
      scan.files.map(file => `${file.path}:${file.size}:${file.digest}`).sort()
    );
    const source = {
      repository: 'DocDamage/RepoDNA' as const,
      revision: REPODNA_REFERENCE_REVISION,
      license: 'MIT' as const,
      integration: 'native' as const,
      copiedSource: false as const
    };
    const stats = createStats(scan, nodes, edges, warnings);
    const cache = {
      entries: scan.files.filter(file => file.parsed).length,
      parserVersion: scan.cache.parserVersion
    };
    const metadata = {
      analysisMode: 'static_text_only' as const,
      executedRepositoryCode: false as const,
      deterministic: true as const
    };
    const stablePayload = {
      schemaVersion: REPOSITORY_ARCHITECTURE_SCHEMA_VERSION as typeof REPOSITORY_ARCHITECTURE_SCHEMA_VERSION,
      repositoryVersion,
      generatedAt: this.generatedAt,
      source,
      repository: { id: structure.repositoryId, name: repositoryName, root: '.' as const },
      nodes,
      edges,
      entrypointIds,
      parserHealth: scan.parserHealth,
      limits: this.limits,
      warnings,
      stats,
      cache,
      metadata
    };
    return { ...stablePayload, snapshotDigest: stableHash([canonicalJson(stablePayload)]) };
  }

  clearCache(): void {
    this.scanner.clearCache();
  }

  cacheStats(): ArchitectureCacheStats {
    return this.scanner.cacheStats();
  }
}

function detectRepositoryName(files: ScannedArchitectureFile[]): string {
  const rootPackage = files.find(file => file.path === 'package.json' && file.content);
  if (rootPackage?.content) {
    try {
      const name = (JSON.parse(rootPackage.content) as { name?: unknown }).name;
      if (typeof name === 'string' && name.trim()) return name.trim();
    } catch {
      // Invalid manifests are reported by the manifest detector.
    }
  }
  return 'repository';
}

function createStats(
  scan: ReturnType<RepositorySourceScanner['scan']>,
  nodes: RepositoryArchitectureSnapshot['nodes'],
  edges: RepositoryArchitectureSnapshot['edges'],
  warnings: ArchitectureWarning[]
): ArchitectureStats {
  return {
    filesDiscovered: scan.filesDiscovered,
    filesAnalyzed: scan.files.filter(file => Boolean(file.content)).length,
    generatedFilesSkipped: scan.generatedFilesSkipped,
    binaryFilesSkipped: scan.binaryFilesSkipped,
    bytesRead: scan.bytesRead,
    symbols: scan.files.reduce((sum, file) => sum + file.symbols.length, 0),
    nodes: nodes.length,
    edges: edges.length,
    routes: nodes.filter(value => value.kind === 'api_route').length,
    tables: nodes.filter(value => value.kind === 'database_table').length,
    migrations: nodes.filter(value => value.kind === 'migration').length,
    tests: nodes.filter(value => value.kind === 'test').length,
    buildTargets: nodes.filter(value => value.kind === 'build_target').length,
    externalDependencies: nodes.filter(value => value.kind === 'external_dependency').length,
    truncated: scan.truncated || warnings.some(warning => /LIMIT_REACHED$/.test(warning.code))
  };
}

function normalizeLimits(options: RepositoryArchitectureBuilderOptions): ArchitectureLimits {
  const number = (
    value: number | undefined,
    fallback: number,
    minimum: number,
    maximum: number
  ): number => Math.max(
    minimum,
    Math.min(maximum, Math.floor(Number.isFinite(value) ? value! : fallback))
  );
  return {
    maxFiles: number(options.maxFiles, DEFAULT_LIMITS.maxFiles, 1, 20_000),
    maxFileBytes: number(options.maxFileBytes, DEFAULT_LIMITS.maxFileBytes, 1024, 2 * 1024 * 1024),
    maxTotalBytes: number(options.maxTotalBytes, DEFAULT_LIMITS.maxTotalBytes, 1024, 512 * 1024 * 1024),
    maxSymbols: number(options.maxSymbols, DEFAULT_LIMITS.maxSymbols, 1, 500_000),
    maxEdges: number(options.maxEdges, DEFAULT_LIMITS.maxEdges, 1, 1_000_000),
    maxPathDepth: number(options.maxPathDepth, DEFAULT_LIMITS.maxPathDepth, 1, 256),
    maxTraversalDepth: number(options.maxTraversalDepth, DEFAULT_LIMITS.maxTraversalDepth, 1, 32),
    maxTraversalNodes: number(options.maxTraversalNodes, DEFAULT_LIMITS.maxTraversalNodes, 1, 50_000),
    includeGenerated: options.includeGenerated ?? DEFAULT_LIMITS.includeGenerated
  };
}

function sortWarnings(values: ArchitectureWarning[]): ArchitectureWarning[] {
  return [...values].sort((left, right) =>
    left.code.localeCompare(right.code)
    || (left.file || '').localeCompare(right.file || '')
    || left.message.localeCompare(right.message));
}
