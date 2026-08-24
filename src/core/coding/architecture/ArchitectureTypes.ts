import { IndexedSymbol } from '../index/ParserProvider';

export const REPOSITORY_ARCHITECTURE_SCHEMA_VERSION = '1.0.0';
export const CANONICAL_ARCHITECTURE_GENERATED_AT = '1970-01-01T00:00:00.000Z';
export const REPODNA_REFERENCE_REVISION = '2e55216e950692c33c8f47b65beb66a6758ed99a';

export type ArchitectureNodeKind =
  | 'repository' | 'project_root' | 'package' | 'module' | 'file' | 'symbol'
  | 'api_route' | 'database_table' | 'migration' | 'test' | 'build_target'
  | 'external_dependency';

export type ArchitectureEdgeKind =
  | 'contains' | 'imports' | 'references' | 'calls' | 'implements' | 'extends'
  | 'tests' | 'registers_route' | 'reads_table' | 'writes_table' | 'creates_table'
  | 'builds' | 'depends_on';

export type ArchitectureAttributeValue = string | number | boolean | string[] | number[];

export interface ArchitectureEvidence {
  file: string;
  line?: number;
  column?: number;
  parser?: string;
  confidence: number;
  detail: string;
}

export interface ArchitectureNode {
  id: string;
  kind: ArchitectureNodeKind;
  label: string;
  path?: string;
  language?: string;
  confidence: number;
  attributes: Record<string, ArchitectureAttributeValue>;
  evidence: ArchitectureEvidence[];
}

export interface ArchitectureEdge {
  id: string;
  kind: ArchitectureEdgeKind;
  source: string;
  target: string;
  confidence: number;
  evidence: ArchitectureEvidence[];
}

export interface ArchitectureWarning {
  code: string;
  message: string;
  file?: string;
}

export interface ArchitectureParserHealth {
  parser: string;
  files: number;
  symbols: number;
  averageConfidence: number;
  fallback: boolean;
  failures: number;
}

export interface ArchitectureLimits {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxSymbols: number;
  maxEdges: number;
  maxPathDepth: number;
  maxTraversalDepth: number;
  maxTraversalNodes: number;
  includeGenerated: boolean;
}

export interface ArchitectureStats {
  filesDiscovered: number;
  filesAnalyzed: number;
  generatedFilesSkipped: number;
  binaryFilesSkipped: number;
  bytesRead: number;
  symbols: number;
  nodes: number;
  edges: number;
  routes: number;
  tables: number;
  migrations: number;
  tests: number;
  buildTargets: number;
  externalDependencies: number;
  truncated: boolean;
}

export interface ArchitectureCacheMetadata {
  entries: number;
  parserVersion: string;
}

export interface ArchitectureCacheStats extends ArchitectureCacheMetadata {
  hits: number;
  misses: number;
}

export interface RepositoryArchitectureSnapshot {
  schemaVersion: typeof REPOSITORY_ARCHITECTURE_SCHEMA_VERSION;
  repositoryVersion: string;
  snapshotDigest: string;
  generatedAt: string;
  source: {
    repository: 'DocDamage/RepoDNA';
    revision: string;
    license: 'MIT';
    integration: 'native';
    copiedSource: false;
  };
  repository: { id: string; name: string; root: '.' };
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  entrypointIds: string[];
  parserHealth: ArchitectureParserHealth[];
  limits: ArchitectureLimits;
  warnings: ArchitectureWarning[];
  stats: ArchitectureStats;
  cache: ArchitectureCacheMetadata;
  metadata: {
    analysisMode: 'static_text_only';
    executedRepositoryCode: false;
    deterministic: true;
  };
}

export interface RepositoryArchitectureProvider {
  build(): RepositoryArchitectureSnapshot;
}

export interface SymbolAnalysisResult {
  parser: string;
  symbols: IndexedSymbol[];
}

export interface ArchitectureSymbolIndexer {
  readonly parserVersion: string;
  indexContentWithReport(file: string, content: string): SymbolAnalysisResult;
}

export interface ScannedArchitectureFile {
  path: string;
  size: number;
  digest: string;
  language?: string;
  generated: boolean;
  binary: boolean;
  parsed: boolean;
  content?: string;
  parser?: string;
  symbols: IndexedSymbol[];
}

export interface ArchitectureQueryOptions {
  maxDepth?: number;
  maxNodes?: number;
  direction?: 'incoming' | 'outgoing' | 'both';
  edgeKinds?: ArchitectureEdgeKind[];
}

export interface ArchitectureQueryResult {
  nodeIds: string[];
  edgeIds: string[];
  truncated: boolean;
  maxDepthReached: number;
  warnings: ArchitectureWarning[];
  matchedEntrypointIds?: string[];
}

export interface ArchitectureFindResult {
  nodeIds: string[];
  truncated: boolean;
}
