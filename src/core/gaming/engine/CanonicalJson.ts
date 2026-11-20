import { createHash } from 'node:crypto';

/** Canonical JSON for data validated at the boundary, never executable objects. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  const visit = (item: unknown, depth: number): string => {
    if (depth > 64) throw new Error('CANONICAL_DEPTH_LIMIT');
    if (item === null) return 'null';
    if (typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Object.is(item, -0)) throw new Error('CANONICAL_NON_FINITE_OR_NEGATIVE_ZERO');
      return JSON.stringify(item);
    }
    if (typeof item !== 'object') throw new Error('CANONICAL_NON_JSON_VALUE');
    if (ancestors.has(item)) throw new Error('CANONICAL_CYCLE');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        const parts: string[] = [];
        for (let index = 0; index < item.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('CANONICAL_SPARSE_OR_ACCESSOR_ARRAY');
          parts.push(visit(descriptor.value, depth + 1));
        }
        if (Reflect.ownKeys(item).some(key => key !== 'length' &&
          (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length))) {
          throw new Error('CANONICAL_ARRAY_PROPERTY');
        }
        return `[${parts.join(',')}]`;
      }
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('CANONICAL_NON_PLAIN_OBJECT');
      const keys = Reflect.ownKeys(item);
      if (keys.some(key => typeof key !== 'string')) throw new Error('CANONICAL_SYMBOL_KEY');
      return `{${(keys as string[]).sort().map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('CANONICAL_NON_DATA_PROPERTY');
        return `${JSON.stringify(key)}:${visit(descriptor.value, depth + 1)}`;
      }).join(',')}}`;
    } finally {
      ancestors.delete(item);
    }
  };
  return visit(value, 0);
}

/** Integrity identifier only. Authorization still requires a server-owned grant. */
export function digestJson(domain: string, value: unknown): string {
  if (!/^[a-zA-Z0-9:._-]{1,80}$/.test(domain)) throw new Error('INVALID_DIGEST_DOMAIN');
  return createHash('sha256').update(domain).update('\n').update(canonicalJson(value)).digest('hex');
}
