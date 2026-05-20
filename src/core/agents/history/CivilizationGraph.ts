export class CivilizationGraph {
  describe(query: string) {
    return { query, nodes: ['place', 'period', 'political entities', 'trade routes', 'technologies', 'neighbors'], edges: ['influenced', 'traded_with', 'conflicted_with'] };
  }
}
