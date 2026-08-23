import {
  ArchitectureEdge,
  ArchitectureEdgeKind,
  ArchitectureFindResult,
  ArchitectureNode,
  ArchitectureQueryOptions,
  ArchitectureQueryResult,
  RepositoryArchitectureSnapshot
} from './ArchitectureTypes';

const DEPENDENCY_KINDS = new Set<ArchitectureEdgeKind>([
  'imports', 'depends_on', 'calls', 'references', 'implements', 'extends'
]);

export class RepositoryArchitectureQuery {
  private readonly outgoing = new Map<string, ArchitectureEdge[]>();
  private readonly incoming = new Map<string, ArchitectureEdge[]>();
  private readonly nodes = new Map<string, ArchitectureNode>();
  private readonly edges = new Map<string, ArchitectureEdge>();

  constructor(private readonly snapshot: RepositoryArchitectureSnapshot) {
    snapshot.nodes.forEach(node => this.nodes.set(node.id, node));
    for (const edge of snapshot.edges) {
      this.edges.set(edge.id, edge);
      const outgoing = this.outgoing.get(edge.source) || [];
      outgoing.push(edge);
      this.outgoing.set(edge.source, outgoing);
      const incoming = this.incoming.get(edge.target) || [];
      incoming.push(edge);
      this.incoming.set(edge.target, incoming);
    }
    this.outgoing.forEach(values => values.sort(edgeOrder));
    this.incoming.forEach(values => values.sort(edgeOrder));
  }

  find(value: string, requestedLimit = 50): ArchitectureFindResult {
    const query = value.trim().toLowerCase();
    const limit = clamp(requestedLimit, 50, 1, this.snapshot.limits.maxTraversalNodes);
    const ranked = this.snapshot.nodes
      .map(node => ({ node, score: score(node, query) }))
      .filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score || left.node.id.localeCompare(right.node.id));
    return {
      nodeIds: ranked.slice(0, limit).map(item => item.node.id),
      truncated: ranked.length > limit
    };
  }

  neighborhood(nodeId: string, options: ArchitectureQueryOptions = {}): ArchitectureQueryResult {
    return this.traverse([nodeId], options);
  }

  reverseDependencies(
    nodeId: string,
    options: Omit<ArchitectureQueryOptions, 'direction' | 'edgeKinds'> = {}
  ): ArchitectureQueryResult {
    return this.traverse([nodeId], {
      ...options,
      direction: 'incoming',
      edgeKinds: [...DEPENDENCY_KINDS]
    });
  }

  testImpact(
    nodeId: string,
    options: Omit<ArchitectureQueryOptions, 'direction'> = {}
  ): ArchitectureQueryResult {
    const dependencyResult = this.reverseDependencies(nodeId, options);
    const impacted = new Set(dependencyResult.nodeIds);
    const testNodeIds = this.snapshot.nodes
      .filter(node => node.kind === 'test')
      .map(node => node.id)
      .filter(testId => (this.outgoing.get(testId) || [])
        .some(edge => edge.kind === 'tests' && impacted.has(edge.target)));
    if (!testNodeIds.length) return dependencyResult;

    const nodeIds = new Set([...dependencyResult.nodeIds, ...testNodeIds]);
    const edgeIds = new Set(dependencyResult.edgeIds);
    for (const testId of testNodeIds) {
      for (const edge of this.outgoing.get(testId) || []) {
        if (edge.kind !== 'tests') continue;
        edgeIds.add(edge.id);
        nodeIds.add(edge.target);
      }
      for (const edge of this.incoming.get(testId) || []) {
        if (edge.kind !== 'contains') continue;
        edgeIds.add(edge.id);
        nodeIds.add(edge.source);
      }
    }
    return this.boundResult(nodeIds, edgeIds, dependencyResult, options.maxNodes);
  }

  entrypointReachability(
    nodeId: string,
    options: Omit<ArchitectureQueryOptions, 'direction'> = {}
  ): ArchitectureQueryResult {
    const result = this.traverse([nodeId], {
      ...options,
      direction: 'incoming',
      edgeKinds: [...DEPENDENCY_KINDS, 'registers_route', 'contains']
    });
    const entrypoints = new Set(this.snapshot.entrypointIds);
    return {
      ...result,
      matchedEntrypointIds: result.nodeIds.filter(id => entrypoints.has(id)).sort()
    };
  }

  nodesFor(result: ArchitectureQueryResult | ArchitectureFindResult): ArchitectureNode[] {
    return result.nodeIds
      .map(id => this.nodes.get(id))
      .filter((node): node is ArchitectureNode => Boolean(node));
  }

  edgesFor(result: ArchitectureQueryResult): ArchitectureEdge[] {
    const nodeIds = new Set(result.nodeIds);
    return result.edgeIds
      .map(id => this.edges.get(id))
      .filter((edge): edge is ArchitectureEdge => Boolean(edge))
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }

  private traverse(startIds: string[], options: ArchitectureQueryOptions): ArchitectureQueryResult {
    const maxDepth = clamp(
      options.maxDepth,
      this.snapshot.limits.maxTraversalDepth,
      0,
      this.snapshot.limits.maxTraversalDepth
    );
    const maxNodes = clamp(
      options.maxNodes,
      this.snapshot.limits.maxTraversalNodes,
      1,
      this.snapshot.limits.maxTraversalNodes
    );
    const direction = options.direction || 'both';
    const kinds = options.edgeKinds ? new Set(options.edgeKinds) : undefined;
    const visited = new Set<string>();
    const edgeIds = new Set<string>();
    const queue = startIds
      .filter(id => this.nodes.has(id))
      .sort()
      .map(id => ({ id, depth: 0 }));
    let maxDepthReached = 0;
    let truncated = false;

    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      if (visited.size >= maxNodes) { truncated = true; break; }
      visited.add(current.id);
      maxDepthReached = Math.max(maxDepthReached, current.depth);
      if (current.depth >= maxDepth) continue;
      const candidates = [
        ...(direction === 'incoming' ? [] : this.outgoing.get(current.id) || []),
        ...(direction === 'outgoing' ? [] : this.incoming.get(current.id) || [])
      ].filter(edge => !kinds || kinds.has(edge.kind)).sort(edgeOrder);
      for (const edge of candidates) {
        const next = edge.source === current.id ? edge.target : edge.source;
        edgeIds.add(edge.id);
        if (!visited.has(next)) queue.push({ id: next, depth: current.depth + 1 });
      }
      queue.sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id));
    }
    const warnings = truncated
      ? [{ code: 'TRAVERSAL_LIMIT_REACHED', message: `Architecture query stopped at ${maxNodes} nodes.` }]
      : [];
    return this.boundResult(visited, edgeIds, {
      nodeIds: [], edgeIds: [], truncated, maxDepthReached, warnings
    }, maxNodes);
  }

  private boundResult(
    nodeIdsInput: Set<string>,
    edgeIdsInput: Set<string>,
    base: ArchitectureQueryResult,
    requestedMaxNodes?: number
  ): ArchitectureQueryResult {
    const maxNodes = clamp(
      requestedMaxNodes,
      this.snapshot.limits.maxTraversalNodes,
      1,
      this.snapshot.limits.maxTraversalNodes
    );
    const allNodeIds = [...nodeIdsInput].filter(id => this.nodes.has(id)).sort();
    const nodeIds = allNodeIds.slice(0, maxNodes);
    const included = new Set(nodeIds);
    const edgeIds = [...edgeIdsInput]
      .map(id => this.edges.get(id))
      .filter((edge): edge is ArchitectureEdge => Boolean(edge))
      .filter(edge => included.has(edge.source) && included.has(edge.target))
      .map(edge => edge.id)
      .sort();
    const truncated = base.truncated || allNodeIds.length > maxNodes;
    const warnings = [...base.warnings];
    if (allNodeIds.length > maxNodes && !warnings.some(warning => warning.code === 'TRAVERSAL_LIMIT_REACHED')) {
      warnings.push({ code: 'TRAVERSAL_LIMIT_REACHED', message: `Architecture query stopped at ${maxNodes} nodes.` });
    }
    return {
      nodeIds,
      edgeIds,
      truncated,
      maxDepthReached: base.maxDepthReached,
      warnings
    };
  }
}

function score(node: ArchitectureNode, query: string): number {
  if (!query) return 1;
  const id = node.id.toLowerCase();
  const label = node.label.toLowerCase();
  const path = node.path?.toLowerCase() || '';
  if (id === query || label === query || path === query) return 100;
  if (label.startsWith(query)) return 80;
  if (path.endsWith(query)) return 70;
  if (label.includes(query)) return 60;
  if (path.includes(query)) return 50;
  if (node.kind.toLowerCase().includes(query)) return 20;
  return 0;
}

function edgeOrder(left: ArchitectureEdge, right: ArchitectureEdge): number {
  return left.kind.localeCompare(right.kind)
    || left.source.localeCompare(right.source)
    || left.target.localeCompare(right.target);
}

function clamp(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  const selected = Number.isFinite(value) ? Math.floor(value!) : fallback;
  return Math.max(minimum, Math.min(maximum, selected));
}
