import {
  ArchitectureEdge,
  ArchitectureEdgeKind,
  ArchitectureEvidence,
  ArchitectureNode,
  ArchitectureWarning
} from './ArchitectureTypes';
import { sortEdges, sortEvidence, sortNodes, stableId } from './ArchitectureIdentity';

export class ArchitectureGraphCollector {
  private readonly nodeMap = new Map<string, ArchitectureNode>();
  private readonly edgeMap = new Map<string, ArchitectureEdge>();
  readonly warnings: ArchitectureWarning[] = [];
  private edgeLimitReported = false;

  constructor(private readonly maxEdges: number) {}

  addNode(node: ArchitectureNode): string {
    const existing = this.nodeMap.get(node.id);
    if (!existing) {
      this.nodeMap.set(node.id, { ...node, evidence: sortEvidence(node.evidence) });
      return node.id;
    }
    existing.confidence = Math.max(existing.confidence, node.confidence);
    existing.attributes = { ...existing.attributes, ...node.attributes };
    existing.evidence = this.mergeEvidence(existing.evidence, node.evidence);
    return node.id;
  }

  addEdge(kind: ArchitectureEdgeKind, source: string, target: string, confidence: number, evidence: ArchitectureEvidence[]): string | undefined {
    if (source === target) return undefined;
    const key = `${kind}\0${source}\0${target}`;
    const existing = this.edgeMap.get(key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.evidence = this.mergeEvidence(existing.evidence, evidence);
      return existing.id;
    }
    if (this.edgeMap.size >= this.maxEdges) {
      if (!this.edgeLimitReported) {
        this.warn('EDGE_LIMIT_REACHED', `Architecture edge limit ${this.maxEdges} was reached.`);
        this.edgeLimitReported = true;
      }
      return undefined;
    }
    const edge: ArchitectureEdge = {
      id: stableId('edge', kind, source, target), kind, source, target,
      confidence, evidence: sortEvidence(evidence)
    };
    this.edgeMap.set(key, edge);
    return edge.id;
  }

  warn(code: string, message: string, file?: string): void {
    const warning = { code, message, ...(file ? { file } : {}) };
    if (!this.warnings.some(value => value.code === code && value.message === message && value.file === file)) {
      this.warnings.push(warning);
    }
  }

  nodes(): ArchitectureNode[] {
    return sortNodes([...this.nodeMap.values()]);
  }

  edges(): ArchitectureEdge[] {
    const known = new Set(this.nodeMap.keys());
    return sortEdges([...this.edgeMap.values()].filter(edge => known.has(edge.source) && known.has(edge.target)));
  }

  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  private mergeEvidence(left: ArchitectureEvidence[], right: ArchitectureEvidence[]): ArchitectureEvidence[] {
    const values = new Map<string, ArchitectureEvidence>();
    for (const evidence of [...left, ...right]) {
      const key = `${evidence.file}\0${evidence.line || ''}\0${evidence.detail}\0${evidence.parser || ''}`;
      const current = values.get(key);
      if (!current || evidence.confidence > current.confidence) values.set(key, evidence);
    }
    return sortEvidence([...values.values()]);
  }
}
