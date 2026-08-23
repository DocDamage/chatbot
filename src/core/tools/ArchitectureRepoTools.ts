import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureQueryResult,
  RepositoryArchitectureBuilder,
  RepositoryArchitectureBuilderOptions,
  RepositoryArchitectureCache,
  RepositoryArchitectureQuery,
  RepositoryArchitectureSnapshot
} from '../coding/architecture';
import {
  ApprovedRepositoryGateway,
  RepositoryAccessError
} from '../coding/security/ApprovedRepositoryGateway';

const QUERY_TYPES = new Set([
  'find',
  'neighborhood',
  'reverse-dependencies',
  'test-impact',
  'entrypoint-reachability'
]);

export function createArchitectureRepoTools(
  workspaceRoot: string,
  approvedRepository = new ApprovedRepositoryGateway(workspaceRoot)
): Tool[] {
  const repository = new ApprovedRepositoryGateway(approvedRepository.approvedRoot, {
    maxFiles: 20_000,
    maxReadBytes: 2 * 1024 * 1024,
    maxSearchBytesPerFile: 2 * 1024 * 1024
  });
  const cache = new RepositoryArchitectureCache();

  const guarded = async (
    action: () => ToolResult | Promise<ToolResult>
  ): Promise<ToolResult> => {
    try {
      return await action();
    } catch (error) {
      if (error instanceof RepositoryAccessError) {
        return { success: false, error: `${error.code}: ${error.message}` };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Repository architecture operation failed.'
      };
    }
  };

  const tool = (
    id: string,
    name: string,
    description: string,
    parameters: Tool['parameters'],
    execute: (params: Record<string, any>) => Promise<ToolResult>
  ): Tool => ({
    id,
    name,
    description,
    category: ToolCategory.CODING,
    parameters,
    execute
  });

  const build = (params: Record<string, any>): {
    snapshot: RepositoryArchitectureSnapshot;
    cacheStats: ReturnType<RepositoryArchitectureCache['stats']>;
  } => {
    if (params.refresh === true) cache.clear();
    const options = buildOptions(params);
    const builder = new RepositoryArchitectureBuilder(
      approvedRepository.approvedRoot,
      options,
      { repository, cache }
    );
    return { snapshot: builder.build(), cacheStats: builder.cacheStats() };
  };

  return [
    tool(
      'get_repository_architecture',
      'getRepositoryArchitecture',
      'Build a deterministic, bounded, static repository architecture snapshot.',
      architectureParameters([
        { name: 'detail', type: 'string', description: 'summary or full', required: false },
        { name: 'maxNodes', type: 'number', description: 'Maximum nodes returned in full detail', required: false },
        { name: 'maxResponseEdges', type: 'number', description: 'Maximum edges returned in full detail', required: false },
        { name: 'includeEvidence', type: 'boolean', description: 'Include source evidence in full detail', required: false }
      ]),
      async params => guarded(() => {
        const { snapshot, cacheStats } = build(params);
        if (String(params.detail || 'summary').toLowerCase() !== 'full') {
          return { success: true, data: architectureSummary(snapshot, cacheStats) };
        }
        const maxNodes = boundedNumber(params.maxNodes, 500, 1, 2000);
        const maxEdges = boundedNumber(params.maxResponseEdges, 1000, 1, 4000);
        const nodes = snapshot.nodes.slice(0, maxNodes);
        const nodeIds = new Set(nodes.map(node => node.id));
        const edges = snapshot.edges
          .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
          .slice(0, maxEdges);
        return {
          success: true,
          data: {
            ...architectureSummary(snapshot, cacheStats),
            nodes: params.includeEvidence === true ? nodes : nodes.map(stripNodeEvidence),
            edges: params.includeEvidence === true ? edges : edges.map(stripEdgeEvidence),
            responseTruncated: nodes.length < snapshot.nodes.length || edges.length < snapshot.edges.length
          }
        };
      })
    ),
    tool(
      'query_repository_architecture',
      'queryRepositoryArchitecture',
      'Search or traverse the deterministic repository architecture graph.',
      architectureParameters([
        { name: 'queryType', type: 'string', description: 'find, neighborhood, reverse-dependencies, test-impact, or entrypoint-reachability', required: true },
        { name: 'value', type: 'string', description: 'Node ID, path, label, or search text', required: true },
        { name: 'depth', type: 'number', description: 'Maximum traversal depth', required: false },
        { name: 'limit', type: 'number', description: 'Maximum graph nodes returned', required: false },
        { name: 'includeEvidence', type: 'boolean', description: 'Include source evidence', required: false }
      ]),
      async params => guarded(() => {
        const queryType = String(params.queryType || '').toLowerCase();
        if (!QUERY_TYPES.has(queryType)) {
          return { success: false, error: `Unsupported architecture query type: ${queryType || '(blank)'}` };
        }
        const value = String(params.value || '').trim();
        if (!value) return { success: false, error: 'Architecture query value is required.' };
        const { snapshot, cacheStats } = build(params);
        const query = new RepositoryArchitectureQuery(snapshot);
        const limit = boundedNumber(params.limit, 200, 1, 1000);
        if (queryType === 'find') {
          const result = query.find(value, limit);
          const nodes = query.nodesFor(result);
          return {
            success: true,
            data: {
              snapshotDigest: snapshot.snapshotDigest,
              result,
              nodes: params.includeEvidence === true ? nodes : nodes.map(stripNodeEvidence),
              cache: cacheStats
            }
          };
        }
        const nodeId = snapshot.nodes.some(node => node.id === value)
          ? value
          : query.find(value, 1).nodeIds[0];
        if (!nodeId) return { success: false, error: `No architecture node matched: ${value}` };
        const options = { maxDepth: optionalNumber(params.depth), maxNodes: limit };
        const result = runQuery(query, queryType, nodeId, options);
        const nodes = query.nodesFor(result);
        const edges = query.edgesFor(result);
        return {
          success: true,
          data: {
            snapshotDigest: snapshot.snapshotDigest,
            matchedNodeId: nodeId,
            result,
            nodes: params.includeEvidence === true ? nodes : nodes.map(stripNodeEvidence),
            edges: params.includeEvidence === true ? edges : edges.map(stripEdgeEvidence),
            cache: cacheStats
          }
        };
      })
    )
  ];
}

function architectureParameters(extra: NonNullable<Tool['parameters']>): NonNullable<Tool['parameters']> {
  return [
    ...extra,
    { name: 'refresh', type: 'boolean', description: 'Clear the incremental parser cache before analysis', required: false },
    { name: 'maxFiles', type: 'number', description: 'Maximum repository files analyzed', required: false },
    { name: 'maxTotalBytes', type: 'number', description: 'Maximum total source bytes read', required: false },
    { name: 'maxFileBytes', type: 'number', description: 'Maximum bytes read from one source file', required: false },
    { name: 'maxSymbols', type: 'number', description: 'Maximum symbols indexed', required: false },
    { name: 'maxEdges', type: 'number', description: 'Maximum architecture edges built', required: false },
    { name: 'maxPathDepth', type: 'number', description: 'Maximum repository path depth analyzed', required: false },
    { name: 'includeGenerated', type: 'boolean', description: 'Include generated source files', required: false }
  ];
}

function buildOptions(params: Record<string, any>): RepositoryArchitectureBuilderOptions {
  return {
    maxFiles: optionalNumber(params.maxFiles),
    maxTotalBytes: optionalNumber(params.maxTotalBytes),
    maxFileBytes: optionalNumber(params.maxFileBytes),
    maxSymbols: optionalNumber(params.maxSymbols),
    maxEdges: optionalNumber(params.maxEdges),
    maxPathDepth: optionalNumber(params.maxPathDepth),
    maxTraversalDepth: optionalNumber(params.depth),
    maxTraversalNodes: optionalNumber(params.limit),
    includeGenerated: params.includeGenerated === true
  };
}

function architectureSummary(
  snapshot: RepositoryArchitectureSnapshot,
  cacheStats: ReturnType<RepositoryArchitectureCache['stats']>
): Record<string, unknown> {
  return {
    schemaVersion: snapshot.schemaVersion,
    repositoryVersion: snapshot.repositoryVersion,
    snapshotDigest: snapshot.snapshotDigest,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source,
    repository: snapshot.repository,
    stats: snapshot.stats,
    limits: snapshot.limits,
    entrypointIds: snapshot.entrypointIds,
    parserHealth: snapshot.parserHealth,
    warnings: snapshot.warnings,
    nodeKinds: countBy(snapshot.nodes, node => node.kind),
    edgeKinds: countBy(snapshot.edges, edge => edge.kind),
    cache: cacheStats,
    metadata: snapshot.metadata
  };
}

function runQuery(
  query: RepositoryArchitectureQuery,
  queryType: string,
  nodeId: string,
  options: { maxDepth?: number; maxNodes?: number }
): ArchitectureQueryResult {
  if (queryType === 'neighborhood') return query.neighborhood(nodeId, options);
  if (queryType === 'reverse-dependencies') return query.reverseDependencies(nodeId, options);
  if (queryType === 'test-impact') return query.testImpact(nodeId, options);
  return query.entrypointReachability(nodeId, options);
}

function stripNodeEvidence(node: ArchitectureNode): Omit<ArchitectureNode, 'evidence'> {
  const { evidence: _ignored, ...result } = node;
  return result;
}

function stripEdgeEvidence(edge: ArchitectureEdge): Omit<ArchitectureEdge, 'evidence'> {
  const { evidence: _ignored, ...result } = edge;
  return result;
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const name = key(value);
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {});
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = optionalNumber(value);
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed ?? fallback)));
}
