import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CacheAnalytics } from '../CacheAnalytics';
import { CacheLevel, MultiLevelCache } from '../MultiLevelCache';
import { DiskCache } from '../DiskCache';
import { SemanticCache } from '../SemanticCache';

describe('cache tail decision matrix', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    for (const tempDir of tempDirs.splice(0)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('covers semantic exact hits, semantic hits, misses, stats, cleanup, and clear', () => {
    const cache = new SemanticCache<string>(3600, 0.5);
    expect(cache.getStats()).toEqual({ size: 0, totalAccess: 0, avgAccessPerEntry: 0 });
    expect(cache.get('missing')).toBeUndefined();

    cache.set('Alpha   Beta', 'value');
    expect(cache.get('alpha beta')).toBe('value');
    expect(cache.get('alpha beta gamma')).toBe('value');
    expect(cache.get('unrelated words')).toBeUndefined();
    expect(cache.getStats()).toMatchObject({ size: 1, totalAccess: 1, avgAccessPerEntry: 1 });

    const internal = (cache as any).cache as Map<string, { timestamp: number; accessCount: number }>;
    for (let index = 0; index < 999; index += 1) cache.set(`entry ${index}`, `value-${index}`);
    const alpha = internal.get('alpha beta')!;
    alpha.timestamp = 0;
    alpha.accessCount = 1;
    cache.set('trigger cleanup', 'last');
    expect(cache.get('alpha beta')).toBeUndefined();

    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });

  it('does not reuse semantically identical prompts across namespaces', () => {
    const cache = new SemanticCache<string>(3600, 0.5);
    cache.set('what happened in 1997?', 'history answer', undefined, 'mode=history');

    expect(cache.get('what happened in 1997?', 'mode=history')).toBe('history answer');
    expect(cache.get('what happened in 1997?', 'mode=music')).toBeUndefined();
  });

  it('covers multi-level hits, misses, errors, promotion, tags, clearing, and warming', async () => {
    const cache = new MultiLevelCache<string>();
    const failing: CacheLevel = {
      level: 0,
      name: 'failing',
      get: jest.fn().mockRejectedValue(new Error('offline')),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const lowerGet = jest.fn(async (key: string) => key === 'lower-key' ? 'lower-value' : undefined);
    const lower: CacheLevel = {
      level: 2,
      name: 'lower',
      get: lowerGet as CacheLevel['get'],
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    cache.addLevel(lower);
    cache.addLevel(failing);

    await expect(cache.get('missing')).resolves.toBeUndefined();
    await expect(cache.get('lower-key')).resolves.toBe('lower-value');
    await expect(cache.get('lower-key')).resolves.toBe('lower-value');

    await cache.setWithTags('tagged', 'value', 10, ['one', 'two']);
    await cache.setWithTags('untagged', 'value', undefined, []);
    expect(await cache.invalidateByTag('missing')).toBe(0);
    expect(await cache.invalidateByTag('one')).toBe(1);
    expect(await cache.invalidateByTags(['two', 'missing'])).toBe(1);

    await cache.warmCache([
      { key: 'warm-a', value: 'a' },
      { key: 'warm-b', value: 'b', ttl: 5 },
    ]);
    await (cache as any).removeKeyTags('tagged');
    await (cache as any).removeKeyTags('missing');
    expect(cache.getStats().levels).toEqual(['failing', 'memory', 'lower']);
    expect(cache.getAnalytics().misses).toBeGreaterThan(0);
    await cache.clear();
  });

  it('covers disk cache misses, values, expiration, invalid files, cleanup, delete, and clear', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disk-cache-matrix-'));
    tempDirs.push(tempDir);
    const cache = new DiskCache(tempDir);
    expect(cache.isEnabled()).toBe(true);
    await expect(cache.get('missing')).resolves.toBeUndefined();

    await cache.set('persistent', { ok: true });
    await expect(cache.get('persistent')).resolves.toEqual({ ok: true });
    await cache.set('expired', 'old', -1);
    await expect(cache.get('expired')).resolves.toBeUndefined();

    const invalidDir = path.join(tempDir, 'invalid');
    fs.mkdirSync(invalidDir, { recursive: true });
    fs.writeFileSync(path.join(invalidDir, 'bad.json'), '{bad', 'utf8');
    await expect(cache.cleanExpired()).resolves.toBe(0);

    await cache.delete('persistent');
    await expect(cache.get('persistent')).resolves.toBeUndefined();
    await cache.clear();
    expect(fs.existsSync(tempDir)).toBe(true);
  });

  it('fails closed when the disk cache directory cannot initialize', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('permission denied');
    });
    const cache = new DiskCache('not-writable');
    expect(cache.isEnabled()).toBe(false);
    await expect(cache.get('key')).resolves.toBeUndefined();
    await expect(cache.set('key', 'value')).resolves.toBeUndefined();
    await expect(cache.delete('key')).resolves.toBeUndefined();
    await expect(cache.cleanExpired()).resolves.toBe(0);
    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it('covers cache analytics hit/miss levels, empty lookup, counters, and reset', () => {
    const analytics = new CacheAnalytics();
    expect(analytics.getLevelMetrics('missing')).toBeUndefined();
    analytics.recordHit('memory');
    analytics.recordMiss('memory');
    analytics.recordMiss('disk');
    analytics.recordEviction();
    analytics.updateSize(4);

    expect(analytics.getLevelMetrics('memory')).toEqual({ hits: 1, misses: 1, hitRate: 50 });
    expect(analytics.getMetrics()).toMatchObject({ hits: 1, misses: 2, size: 4, evictions: 1 });
    analytics.reset();
    expect(analytics.getMetrics()).toMatchObject({ hits: 0, misses: 0, hitRate: 0, size: 0, evictions: 0 });
  });
});
