/**
 * Section 38: Implementation Dependency Graph Engine
 * Enforces DAG execution order, prerequisite verification, and cycle detection.
 */
import {
  CRKPhaseId,
  DependencyNode,
} from '../../types/dependency-graph';

export const CANONICAL_DEPENDENCY_NODES: Record<CRKPhaseId, DependencyNode> = {
  P00: { id: 'P00', name: 'Inventory and Baseline', isOptional: false, dependencies: [], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P01: { id: 'P01', name: 'Canonical Chat Runtime', isOptional: false, dependencies: ['P00'], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P02: { id: 'P02', name: 'Bot Profiles and Config', isOptional: false, dependencies: ['P01'], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P03: { id: 'P03', name: 'Conversation State & Variables', isOptional: false, dependencies: ['P02'], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P04: { id: 'P04', name: 'Workflow Engine', isOptional: false, dependencies: ['P03'], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P05: { id: 'P05', name: 'Context Planner', isOptional: false, dependencies: ['P04'], milestone: 'MILESTONE_A', status: 'COMPLETED' },
  P06: { id: 'P06', name: 'Dataset Registry & Infrastructure', isOptional: false, dependencies: ['P05'], milestone: 'MILESTONE_B', status: 'COMPLETED' },
  P07: { id: 'P07', name: 'Official Documentation Pack', isOptional: false, dependencies: ['P06'], milestone: 'MILESTONE_B', status: 'COMPLETED' },
  P08: { id: 'P08', name: 'Knowledge Router', isOptional: false, dependencies: ['P07'], milestone: 'MILESTONE_B', status: 'COMPLETED' },
  P09: { id: 'P09', name: 'Authority/Freshness/Version', isOptional: false, dependencies: ['P08'], milestone: 'MILESTONE_B', status: 'COMPLETED' },
  P10: { id: 'P10', name: 'Model Registry and Policy', isOptional: false, dependencies: ['P09'], milestone: 'MILESTONE_C', status: 'COMPLETED' },
  P11: { id: 'P11', name: 'Prompt and Context Assembler', isOptional: false, dependencies: ['P10'], milestone: 'MILESTONE_C', status: 'COMPLETED' },
  P12: { id: 'P12', name: 'Grounding and Abstention', isOptional: false, dependencies: ['P11'], milestone: 'MILESTONE_C', status: 'COMPLETED' },
  P13: { id: 'P13', name: 'Developer Q&A Pack', isOptional: false, dependencies: ['P12'], milestone: 'MILESTONE_D', status: 'COMPLETED' },
  P14: { id: 'P14', name: 'Curated Source-Code Pack', isOptional: false, dependencies: ['P13'], milestone: 'MILESTONE_D', status: 'COMPLETED' },
  P15: { id: 'P15', name: 'Citation & Provenance UX', isOptional: false, dependencies: ['P14'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P16: { id: 'P16', name: 'Feedback Consolidation', isOptional: false, dependencies: ['P15'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P17: { id: 'P17', name: 'Response Quality Gate', isOptional: false, dependencies: ['P16'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P18: { id: 'P18', name: 'Tool Truthfulness & Side-Effect Ledger', isOptional: false, dependencies: ['P17'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P19: { id: 'P19', name: 'Wikipedia + Wikidata Pack', isOptional: true, dependencies: ['P06', 'P09'], milestone: 'MILESTONE_F', status: 'COMPLETED' },
  P20: { id: 'P20', name: 'Research and Math Packs', isOptional: true, dependencies: ['P06', 'P09'], milestone: 'MILESTONE_F', status: 'COMPLETED' },
  P21: { id: 'P21', name: 'Educational Web & Multilingual', isOptional: true, dependencies: ['P06', 'P09'], milestone: 'MILESTONE_F', status: 'COMPLETED' },
  P22: { id: 'P22', name: 'Voice & External Adapters', isOptional: true, dependencies: ['P01'], milestone: 'MILESTONE_F', status: 'COMPLETED' },
  P23: { id: 'P23', name: 'Chat Diagnostics', isOptional: false, dependencies: ['P18'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P24: { id: 'P24', name: 'Golden Conversation Suite', isOptional: false, dependencies: ['P23'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P25: { id: 'P25', name: 'Dataset & Policy A/B Evaluation', isOptional: false, dependencies: ['P24'], milestone: 'MILESTONE_E', status: 'COMPLETED' },
  P26: { id: 'P26', name: 'Automated Knowledge Maintenance & Cutover', isOptional: false, dependencies: ['P25', 'P06'], milestone: 'MILESTONE_G', status: 'COMPLETED' },
};

export class ImplementationDependencyGraph {
  private nodes: Map<CRKPhaseId, DependencyNode>;

  constructor(customNodes?: Record<CRKPhaseId, DependencyNode>) {
    this.nodes = new Map();
    const source = customNodes || CANONICAL_DEPENDENCY_NODES;
    for (const [key, val] of Object.entries(source)) {
      this.nodes.set(key as CRKPhaseId, { ...val });
    }
  }

  getNode(phaseId: CRKPhaseId): DependencyNode | undefined {
    return this.nodes.get(phaseId);
  }

  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  getPrerequisites(phaseId: CRKPhaseId): CRKPhaseId[] {
    return this.nodes.get(phaseId)?.dependencies || [];
  }

  getDownstreamDependents(phaseId: CRKPhaseId): CRKPhaseId[] {
    const dependents: CRKPhaseId[] = [];
    for (const node of this.nodes.values()) {
      if (node.dependencies.includes(phaseId)) {
        dependents.push(node.id);
      }
    }
    return dependents;
  }

  isPhaseReady(phaseId: CRKPhaseId, completedPhases: Set<CRKPhaseId>): boolean {
    const prereqs = this.getPrerequisites(phaseId);
    return prereqs.every((p) => completedPhases.has(p));
  }

  detectCycles(): boolean {
    const visited = new Set<CRKPhaseId>();
    const recStack = new Set<CRKPhaseId>();

    const dfs = (curr: CRKPhaseId): boolean => {
      visited.add(curr);
      recStack.add(curr);

      const prereqs = this.getPrerequisites(curr);
      for (const neighbor of prereqs) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // cycle detected
        }
      }

      recStack.delete(curr);
      return false;
    };

    for (const phaseId of this.nodes.keys()) {
      if (!visited.has(phaseId)) {
        if (dfs(phaseId)) return true;
      }
    }
    return false;
  }

  getTopologicalOrder(): CRKPhaseId[] {
    const visited = new Set<CRKPhaseId>();
    const order: CRKPhaseId[] = [];

    const visit = (id: CRKPhaseId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const prereqs = this.getPrerequisites(id);
      for (const p of prereqs) {
        visit(p);
      }
      order.push(id);
    };

    for (const phaseId of this.nodes.keys()) {
      visit(phaseId);
    }

    return order;
  }
}
