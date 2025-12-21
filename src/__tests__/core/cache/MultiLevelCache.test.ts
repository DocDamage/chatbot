/**
 * Unit tests for MultiLevelCache
 */

import { MultiLevelCache } from '../../../core/cache/MultiLevelCache';

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache<string>;

  beforeEach(() => {
    cache = new MultiLevelCache<string>();
  });

  it('should initialize with L1 cache', () => {
    const stats = cache.getStats();
    expect(stats.levels).toBeGreaterThanOrEqual(1);
    expect(stats.levels).toContain('memory');
  });

  it('should set and get values', async () => {
    await cache.set('test-key', 'test-value', 3600);
    const value = await cache.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should return undefined for non-existent keys', async () => {
    const value = await cache.get('non-existent');
    expect(value).toBeUndefined();
  });

  it('should delete values', async () => {
    await cache.set('test-key', 'test-value');
    await cache.delete('test-key');
    const value = await cache.get('test-key');
    expect(value).toBeUndefined();
  });

  it('should respect TTL', async () => {
    await cache.set('test-key', 'test-value', 1);
    await new Promise(resolve => setTimeout(resolve, 1100));
    const value = await cache.get('test-key');
    expect(value).toBeUndefined();
  });

  it('should provide cache statistics', () => {
    const stats = cache.getStats();
    expect(stats).toHaveProperty('levels');
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
  });
});

