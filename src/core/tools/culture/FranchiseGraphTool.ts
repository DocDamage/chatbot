export class FranchiseGraphTool {
  graph(franchise: string) {
    return {
      franchise,
      nodes: ['origin work', 'sequels/adaptations', 'creators', 'studios/publishers', 'influences'],
      relationships: ['adapted_into', 'influenced_by', 'spin_off', 'rebooted_as']
    };
  }
}
