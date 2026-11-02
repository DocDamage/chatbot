import {
  ImplementationDependencyGraph,
  CANONICAL_DEPENDENCY_NODES,
} from '../ImplementationDependencyGraph';
import { CRKPhaseId } from '../../../types/dependency-graph';

describe('ImplementationDependencyGraph (Section 38 Dependency Graph)', () => {
  let graph: ImplementationDependencyGraph;

  beforeEach(() => {
    graph = new ImplementationDependencyGraph();
  });

  it('contains all 27 CRK phases (P00-P26)', () => {
    const allNodes = graph.getAllNodes();
    expect(allNodes).toHaveLength(27);
  });

  it('confirms no circular dependencies in canonical graph', () => {
    const hasCycle = graph.detectCycles();
    expect(hasCycle).toBe(false);
  });

  it('produces a valid topological order respecting dependencies', () => {
    const order = graph.getTopologicalOrder();
    expect(order.indexOf('P00')).toBeLessThan(order.indexOf('P01'));
    expect(order.indexOf('P01')).toBeLessThan(order.indexOf('P02'));
    expect(order.indexOf('P05')).toBeLessThan(order.indexOf('P06'));
    expect(order.indexOf('P06')).toBeLessThan(order.indexOf('P07'));
    expect(order.indexOf('P25')).toBeLessThan(order.indexOf('P26'));
  });

  it('evaluates phase readiness correctly based on satisfied prerequisites', () => {
    const completed = new Set<CRKPhaseId>(['P00', 'P01', 'P02', 'P03', 'P04']);
    expect(graph.isPhaseReady('P05', completed)).toBe(true);
    expect(graph.isPhaseReady('P06', completed)).toBe(false); // requires P05
  });

  it('queries downstream dependents accurately', () => {
    const downstream = graph.getDownstreamDependents('P06');
    expect(downstream).toContain('P07');
    expect(downstream).toContain('P26');
  });
});
