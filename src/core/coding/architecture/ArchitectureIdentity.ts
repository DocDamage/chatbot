import { createHash } from 'crypto';
import { ArchitectureEdge, ArchitectureEvidence, ArchitectureNode } from './ArchitectureTypes';

export function normalizeRepositoryPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  return normalized === '' ? '.' : normalized;
}

export function stableHash(parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(String(part)).update('\0');
  return hash.digest('hex');
}

export function stableId(kind: string, ...parts: string[]): string {
  return `${kind}:${stableHash([kind, ...parts.map(normalizeRepositoryPath)]).slice(0, 24)}`;
}

export function contentDigest(content: string): string {
  return stableHash([content]);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sortEvidence(values: ArchitectureEvidence[]): ArchitectureEvidence[] {
  return [...values].sort((left, right) =>
    left.file.localeCompare(right.file)
    || (left.line || 0) - (right.line || 0)
    || left.detail.localeCompare(right.detail)
    || left.confidence - right.confidence);
}

export function sortNodes(values: ArchitectureNode[]): ArchitectureNode[] {
  return [...values].sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

export function sortEdges(values: ArchitectureEdge[]): ArchitectureEdge[] {
  return [...values].sort((left, right) => left.kind.localeCompare(right.kind) || left.source.localeCompare(right.source) || left.target.localeCompare(right.target));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonicalize(record[key])]));
}
