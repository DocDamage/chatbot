/**
 * Memoization utilities for performance optimization
 */

/**
 * Memoize a function with configurable cache size and TTL
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number;
    ttl?: number; // Time to live in milliseconds
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const {
    maxSize = 100,
    ttl,
    keyGenerator = (...args) => JSON.stringify(args),
  } = options;

  const cache = new Map<string, { value: ReturnType<T>; expiresAt?: number }>();
  const accessOrder: string[] = []; // For LRU eviction

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);

    // Check if cached and not expired
    if (cached) {
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        cache.delete(key);
        const index = accessOrder.indexOf(key);
        if (index > -1) accessOrder.splice(index, 1);
      } else {
        // Move to end (most recently used)
        const index = accessOrder.indexOf(key);
        if (index > -1) {
          accessOrder.splice(index, 1);
        }
        accessOrder.push(key);
        return cached.value;
      }
    }

    // Compute value
    const value = fn(...args);
    const expiresAt = ttl ? Date.now() + ttl : undefined;

    // Add to cache
    cache.set(key, { value, expiresAt });
    accessOrder.push(key);

    // Evict if over max size (LRU)
    if (cache.size > maxSize) {
      const oldestKey = accessOrder.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    return value;
  }) as T;
}

/**
 * Async memoization
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    maxSize?: number;
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const {
    maxSize = 100,
    ttl,
    keyGenerator = (...args) => JSON.stringify(args),
  } = options;

  const cache = new Map<string, { value: Promise<ReturnType<T>>; expiresAt?: number }>();
  const accessOrder: string[] = [];

  return ((...args: Parameters<T>) => {
    const key = keyGenerator(...args);
    const cached = cache.get(key);

    if (cached) {
      if (cached.expiresAt && cached.expiresAt < Date.now()) {
        cache.delete(key);
        const index = accessOrder.indexOf(key);
        if (index > -1) accessOrder.splice(index, 1);
      } else {
        const index = accessOrder.indexOf(key);
        if (index > -1) {
          accessOrder.splice(index, 1);
        }
        accessOrder.push(key);
        return cached.value;
      }
    }

    const value = fn(...args);
    const expiresAt = ttl ? Date.now() + ttl : undefined;

    cache.set(key, { value, expiresAt });
    accessOrder.push(key);

    if (cache.size > maxSize) {
      const oldestKey = accessOrder.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    return value;
  }) as T;
}

