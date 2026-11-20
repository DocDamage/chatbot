import path from 'path';
import type { ToolFile } from './ToolWorkspace';
import { WorkspaceFilePolicy } from '../security/WorkspaceFilePolicy';
import { godotDependencies } from './dependencies/GodotDependencies';
import { mzDependencies } from './dependencies/MzDependencies';
import { sourceDependencies } from './dependencies/SourceDependencies';

export interface DependencyEdge { from: string; reference: string; kind: string; to?: string; reason?: string }
export interface DependencyGraph { edges: DependencyEdge[]; limitations: string[]; omitted: number }
export type AddDependency = (from: string, reference: string, kind: string, rootRelative?: boolean, unresolved?: string) => void;

/** Static references only. Never evaluates a project script, configuration or tool command. */
export function buildProjectDependencies(records: ToolFile[], known: Set<string>, policy: WorkspaceFilePolicy): DependencyGraph {
  const graph: DependencyGraph = { edges: [], limitations: [], omitted: 0 }, seen = new Set<string>();
  const add: AddDependency = (from, reference, kind, rootRelative = false, unresolved) => {
    if (reference.length > 2048) { graph.omitted++; return; }
    let to: string | undefined;
    if (!unresolved) {
      const value = reference.startsWith('res://') ? reference.slice(6) : reference;
      const candidate = path.posix.normalize(rootRelative || reference.startsWith('res://') ? value : path.posix.join(path.posix.dirname(from), value));
      try {
        if (!path.posix.isAbsolute(candidate) && !candidate.startsWith('../') && !candidate.includes(':') && known.has(candidate) && policy.classify(candidate).role !== 'excluded') to = candidate;
      } catch { /* Malformed paths remain unresolved; no filesystem fallback. */ }
    }
    const edge = { from, reference, kind, ...(to ? { to } : { reason: unresolved || 'Target missing, excluded, outside scope or outside the discovery budget' }) };
    const key = JSON.stringify(edge); if (seen.has(key)) return; seen.add(key);
    if (graph.edges.length >= 2000) { graph.omitted++; return; }
    graph.edges.push(edge);
  };
  if (policy.kind === 'godot') godotDependencies(records, add);
  else if (policy.kind === 'rpg-maker-mz') mzDependencies(records, add, graph.limitations);
  else sourceDependencies(records, known, policy.kind, add, graph.limitations);
  if (graph.omitted) graph.limitations.push('Dependency edge budget (2000) reached; request a smaller working set.');
  return graph;
}
