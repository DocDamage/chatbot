import {
  REPODNA_REFERENCE_REVISION,
  REPOSITORY_ARCHITECTURE_SCHEMA_VERSION,
  RepositoryArchitectureSnapshot
} from './ArchitectureTypes';
import { canonicalJson, stableHash } from './ArchitectureIdentity';

export interface ArchitectureValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateRepositoryArchitectureSnapshot(value: unknown): ArchitectureValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['Snapshot must be an object.'] };
  }
  const snapshot = value as Partial<RepositoryArchitectureSnapshot>;
  if (snapshot.schemaVersion !== REPOSITORY_ARCHITECTURE_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion: ${String(snapshot.schemaVersion)}`);
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.repositoryVersion || '')) {
    errors.push('repositoryVersion must be a SHA-256 digest.');
  }
  if (!/^[a-f0-9]{64}$/.test(snapshot.snapshotDigest || '')) {
    errors.push('snapshotDigest must be a SHA-256 digest.');
  }
  if (!snapshot.repository || snapshot.repository.root !== '.') {
    errors.push('repository.root must be the relative approved root marker.');
  }
  if (snapshot.source?.revision !== REPODNA_REFERENCE_REVISION) {
    errors.push('source.revision must identify the reviewed RepoDNA revision.');
  }
  if (!Array.isArray(snapshot.nodes)) errors.push('nodes must be an array.');
  if (!Array.isArray(snapshot.edges)) errors.push('edges must be an array.');
  if (!Array.isArray(snapshot.parserHealth)) errors.push('parserHealth must be an array.');
  if (!Array.isArray(snapshot.warnings)) errors.push('warnings must be an array.');
  if (snapshot.metadata?.executedRepositoryCode !== false) {
    errors.push('metadata.executedRepositoryCode must be false.');
  }
  if (snapshot.metadata?.analysisMode !== 'static_text_only') {
    errors.push('metadata.analysisMode must be static_text_only.');
  }
  if (!snapshot.generatedAt || Number.isNaN(Date.parse(snapshot.generatedAt))) {
    errors.push('generatedAt must be an ISO-8601 timestamp.');
  }

  const nodes = snapshot.nodes || [];
  const edges = snapshot.edges || [];
  const nodeIds = new Set(nodes.map(node => node.id));
  if (nodeIds.size !== nodes.length) errors.push('Node IDs must be unique.');
  const edgeIds = new Set(edges.map(edge => edge.id));
  if (edgeIds.size !== edges.length) errors.push('Edge IDs must be unique.');
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references an unknown node.`);
    }
  }
  for (const node of nodes) {
    if (node.path && !isRepositoryRelative(node.path)) {
      errors.push(`Node ${node.id} has a non-relative path.`);
    }
    for (const evidence of node.evidence) {
      if (!isRepositoryRelative(evidence.file)) {
        errors.push(`Node ${node.id} has non-relative evidence.`);
      }
    }
  }
  for (const edge of edges) {
    for (const evidence of edge.evidence) {
      if (!isRepositoryRelative(evidence.file)) {
        errors.push(`Edge ${edge.id} has non-relative evidence.`);
      }
    }
  }
  if (snapshot.snapshotDigest && snapshot.schemaVersion === REPOSITORY_ARCHITECTURE_SCHEMA_VERSION) {
    const { snapshotDigest: _ignored, ...payload } = snapshot as RepositoryArchitectureSnapshot;
    const expected = stableHash([canonicalJson(payload)]);
    if (snapshot.snapshotDigest !== expected) errors.push('snapshotDigest does not match the canonical payload.');
  }
  return { valid: errors.length === 0, errors };
}

function isRepositoryRelative(value: string): boolean {
  const normalized = value.replace(/\\/g, '/');
  return normalized === '.'
    || (!normalized.startsWith('/')
      && !/^[A-Za-z]:/.test(normalized)
      && normalized !== '..'
      && !normalized.startsWith('../'));
}
