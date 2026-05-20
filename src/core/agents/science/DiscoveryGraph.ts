export class DiscoveryGraph {
  graph(query: string) {
    return { query, nodes: ['predecessors', 'contributors', 'experiment', 'popularization', 'commercialization'], edges: ['enabled_by', 'tested_by', 'diffused_to'] };
  }
}
