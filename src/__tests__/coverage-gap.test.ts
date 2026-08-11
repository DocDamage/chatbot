import fs from 'fs';
import os from 'os';
import path from 'path';

import { retry, retryWithCondition, createRetryPolicy } from '../utils/retry';
import { memoize, memoizeAsync } from '../utils/memoize';
import { CacheManager } from '../utils/cache';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ContractViolationError,
} from '../utils/errors';
import { ServiceRegistry, Service } from '../services/ServiceRegistry';
import { RateLimiter } from '../middleware/rateLimiter';
import { DiskCache } from '../core/cache/DiskCache';
import { MultiLevelCache } from '../core/cache/MultiLevelCache';
import { CircuitBreaker, CircuitState } from '../mesh/CircuitBreaker';
import { KnowledgeGraph } from '../core/knowledge/KnowledgeGraph';
import { FeedbackCollector, FeedbackData } from '../core/learning/FeedbackCollector';
import { ToonSerializer, getToonSerializer } from '../core/optimization/ToonSerializer';
import { QueryEnhancer } from '../core/knowledge/QueryEnhancer';
import { BalanceSimulator } from '../core/agents/gamedev/BalanceSimulator';

const feedback = (overrides: Partial<FeedbackData> = {}): FeedbackData => ({
  responseId: `response-${Math.random()}`,
  userId: 'user-1',
  sessionId: 'session-1',
  timestamp: new Date(),
  ...overrides,
});

describe('coverage-critical utilities', () => {
  it('covers retry success, retryable failures, terminal failures, and policies', async () => {
    const success = await retry(async () => 'ok', { initialDelayMs: 0 });
    expect(success).toEqual({ success: true, result: 'ok', attempts: 1 });

    const nonRetryable = new Error('bad input');
    const stopped = await retry(async () => { throw nonRetryable; }, {
      retryableErrors: () => false,
      initialDelayMs: 0,
    });
    expect(stopped).toEqual({ success: false, error: nonRetryable, attempts: 1 });

    let attempts = 0;
    const recovered = await retry(async () => {
      attempts++;
      if (attempts < 2) {
        const error: any = new Error('temporary');
        error.code = 'ECONNRESET';
        throw error;
      }
      return 'recovered';
    }, { initialDelayMs: 0, maxAttempts: 3, maxDelayMs: 0 });
    expect(recovered).toEqual({ success: true, result: 'recovered', attempts: 2 });

    const exhausted = await retry(async () => {
      const error: any = new Error('busy');
      error.response = { status: 503 };
      throw error;
    }, { initialDelayMs: 0, maxAttempts: 2, maxDelayMs: 0 });
    expect(exhausted.success).toBe(false);
    expect(exhausted.attempts).toBe(2);

    const noRetry = await retryWithCondition(async () => 2, () => false, { initialDelayMs: 0 });
    expect(noRetry).toEqual({ success: true, result: 2, attempts: 1 });

    let conditionAttempts = 0;
    const conditionResult = await retryWithCondition(
      async () => ++conditionAttempts,
      result => result < 2,
      { initialDelayMs: 0, maxAttempts: 3, maxDelayMs: 0 }
    );
    expect(conditionResult).toEqual({ success: true, result: 2, attempts: 2 });

    const conditionExhausted = await retryWithCondition(async () => 'still-bad', () => true, {
      initialDelayMs: 0,
      maxAttempts: 2,
      maxDelayMs: 0,
    });
    expect(conditionExhausted).toEqual({ success: false, result: 'still-bad', attempts: 2 });

    let errorAttempts = 0;
    const conditionError = await retryWithCondition(async () => {
      errorAttempts++;
      if (errorAttempts === 1) {
        const error: any = new Error('temporary');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'after-error';
    }, () => false, { initialDelayMs: 0, maxAttempts: 2, maxDelayMs: 0 });
    expect(conditionError.result).toBe('after-error');

    const policy = createRetryPolicy({ maxAttempts: 1, initialDelayMs: 0 });
    await expect(policy(async () => 'policy-result')).resolves.toMatchObject({ result: 'policy-result' });
  });

  it('covers synchronous and asynchronous memoization, TTL, and LRU eviction', async () => {
    let calls = 0;
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const memoized = memoize((value: string) => `${value}-${++calls}`, { maxSize: 1, ttl: 10 });

    expect(memoized('a')).toBe('a-1');
    expect(memoized('a')).toBe('a-1');
    expect(calls).toBe(1);
    now.mockReturnValue(1011);
    expect(memoized('a')).toBe('a-2');
    expect(memoized('b')).toBe('b-3');
    expect(memoized('a')).toBe('a-4');

    const keyed = memoize((left: string, right: string) => `${left}:${right}`, {
      keyGenerator: (left, right) => `${left}|${right}`,
    });
    expect(keyed('a', 'b')).toBe('a:b');
    expect(keyed('a', 'b')).toBe('a:b');

    let asyncCalls = 0;
    const asyncMemoized = memoizeAsync(async (value: number) => ++asyncCalls + value, { maxSize: 1, ttl: 10 });
    expect(await asyncMemoized(1)).toBe(2);
    expect(await asyncMemoized(1)).toBe(2);
    now.mockReturnValue(1022);
    expect(await asyncMemoized(1)).toBe(3);
    expect(await asyncMemoized(2)).toBe(5);
    expect(await asyncMemoized(1)).toBe(5);
    now.mockRestore();
  });

  it('covers cache statistics, invalidation, and error classes', () => {
    const cache = new CacheManager(60);
    const defaultCache = new CacheManager();
    defaultCache.clear();
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.set('key', { value: 1 })).toBe(true);
    expect(cache.set('ttl-key', 'value', 10)).toBe(true);
    expect(cache.get<{ value: number }>('key')).toEqual({ value: 1 });
    expect(cache.getStats()).toMatchObject({ hits: 1, misses: 1, sets: 2, hitRate: 50, size: 2 });
    expect(cache.generateKey('a', 1)).toHaveLength(16);
    expect(cache.delete('key')).toBe(1);
    cache.clear();
    expect(cache.getStats()).toMatchObject({ hits: 0, misses: 0, sets: 0, hitRate: 0, size: 0 });

    const errors = [
      new AppError('app', 418, 'APP', { detail: true }),
      new AppError('default'),
      new ValidationError('invalid', { field: 'name' }),
      new AuthenticationError(),
      new AuthenticationError('custom auth'),
      new AuthorizationError(),
      new NotFoundError('Widget'),
      new RateLimitError(undefined, 5),
      new ServiceUnavailableError('database'),
      new ServiceUnavailableError('database', 'offline'),
      new ContractViolationError('unsafe', { action: 'run' }),
      new NotFoundError(),
    ];
    expect(errors.map(error => [error.name, error.statusCode])).toEqual([
      ['AppError', 418],
      ['AppError', 500],
      ['ValidationError', 400],
      ['AuthenticationError', 401],
      ['AuthenticationError', 401],
      ['AuthorizationError', 403],
      ['NotFoundError', 404],
      ['RateLimitError', 429],
      ['ServiceUnavailableError', 503],
      ['ServiceUnavailableError', 503],
      ['ContractViolationError', 403],
      ['NotFoundError', 404],
    ]);
  });

  it('covers default construction for the game-development simulator', () => {
    expect(new BalanceSimulator()).toBeInstanceOf(BalanceSimulator);
  });

  it('covers service registration and health transitions', () => {
    const registry = new ServiceRegistry();
    const healthy: Service = { id: 'one', name: 'One', url: 'http://one', health: 'healthy' };
    const unknown: Service = { id: 'two', name: 'Two', url: 'http://two', health: 'unknown' };
    registry.register(healthy);
    registry.register(unknown);
    expect(registry.get('one')).toBe(healthy);
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getHealthy()).toEqual([healthy]);
    registry.updateHealth('two', 'healthy');
    registry.updateHealth('missing', 'unhealthy');
    expect(registry.getHealthy()).toHaveLength(2);
    registry.unregister('one');
    expect(registry.get('one')).toBeUndefined();
  });
});

describe('coverage-critical infrastructure', () => {
  it('covers in-memory rate limiting keys, headers, limits, and fail-open behavior', async () => {
    const request = (extra: any = {}) => ({ ip: '127.0.0.1', headers: {}, body: {}, ...extra }) as any;
    const response = () => ({ setHeader: jest.fn() }) as any;

    const limiter = new RateLimiter(60_000, 1, undefined, undefined, false);
    const middleware = limiter.middleware();
    const next = jest.fn();
    const res = response();
    await middleware(request({ user: { userId: 'u1' } }), res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
    next.mockClear();
    await middleware(request({ user: { userId: 'u1' } }), response(), next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(RateLimitError);

    const apiLimiter = new RateLimiter(60_000, 10, undefined, undefined, false);
    const apiMiddleware = apiLimiter.middleware();
    const apiNext = jest.fn();
    await apiMiddleware(request({ apiKey: { id: 'key', rateLimit: 1 } }), response(), apiNext);
    await apiMiddleware(request({ apiKey: { id: 'key', rateLimit: 1 } }), response(), apiNext);
    expect(apiNext.mock.calls[1][0]).toBeInstanceOf(RateLimitError);

    const keys = new RateLimiter(60_000, 10);
    expect((keys as any).defaultKeyGenerator(request({ apiKey: { id: 'key' } }))).toBe('apikey:key');
    expect((keys as any).defaultKeyGenerator(request({ body: { sessionId: 's' } }))).toBe('session:s');
    expect((keys as any).defaultKeyGenerator(request({ ip: undefined, headers: { 'x-forwarded-for': '10.0.0.1' } }))).toBe('ip:10.0.0.1');
    expect(RateLimiter.create({ windowMs: 10, maxRequests: 2, failOpen: true })).toBeInstanceOf(RateLimiter);

    const openLimiter = new RateLimiter(10, 1, undefined, undefined, true);
    (openLimiter as any).useRedis = true;
    (openLimiter as any).redisClient = { incr: jest.fn().mockRejectedValue(new Error('store failed')) };
    const open = openLimiter.middleware();
    const openNext = jest.fn();
    await open(request(), response(), openNext);
    expect(openNext).toHaveBeenCalledWith();
    const closedLimiter = new RateLimiter(10, 1, undefined, undefined, false);
    (closedLimiter as any).useRedis = true;
    (closedLimiter as any).redisClient = { incr: jest.fn().mockRejectedValue(new Error('store failed')) };
    const closed = closedLimiter.middleware();
    const closedNext = jest.fn();
    await closed(request(), response(), closedNext);
    expect(closedNext.mock.calls[0][0]).toBeInstanceOf(ServiceUnavailableError);
  });

  it('covers disk and multi-level cache persistence and tag invalidation', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-cache-'));
    const disk = new DiskCache(root);
    expect(disk.isEnabled()).toBe(true);
    await disk.set('live', { value: 1 });
    expect(await disk.get<{ value: number }>('live')).toEqual({ value: 1 });
    expect(await disk.get('missing')).toBeUndefined();
    await disk.set('expired', 'old', -1);
    expect(await disk.get('expired')).toBeUndefined();
    await disk.delete('live');
    expect(await disk.get('live')).toBeUndefined();
    await disk.set('expired-again', 'old', -1);
    fs.writeFileSync(path.join(root, 'invalid.json'), '{invalid');
    expect(await disk.cleanExpired()).toBeGreaterThanOrEqual(1);
    await disk.clear();
    expect(fs.existsSync(root)).toBe(true);

    const multi = new MultiLevelCache<any>(undefined, path.join(root, 'l3'));
    await multi.set('a', { ok: true });
    expect(await multi.get('a')).toEqual({ ok: true });
    await multi.setWithTags('tagged', 'value', undefined, ['group', 'other']);
    expect(await multi.invalidateByTag('group')).toBe(1);
    expect(await multi.invalidateByTag('missing')).toBe(0);
    await multi.setWithTags('one', 1, undefined, ['many']);
    await multi.setWithTags('two', 2, undefined, ['many']);
    expect(await multi.invalidateByTags(['many'])).toBe(2);
    multi.addLevel({
      level: 0,
      name: 'test',
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      clear: async () => undefined,
    });
    await multi.warmCache([{ key: 'warm', value: 3 }]);
    expect(multi.getStats().levels).toContain('test');
    expect(multi.getAnalytics()).toBeDefined();
    await multi.delete('warm');
    await multi.clear();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('covers circuit breaker success, failure, open, recovery, and reset', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, successThreshold: 2, timeout: 10_000 });
    await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
    await expect(breaker.execute(async () => { throw new Error('one'); })).rejects.toThrow('one');
    await expect(breaker.execute(async () => { throw new Error('two'); })).rejects.toThrow('two');
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    await expect(breaker.execute(async () => 'blocked')).rejects.toThrow('OPEN');
    (breaker as any).lastFailureTime = Date.now() - 20_000;
    await expect(breaker.execute(async () => 'half-open')).resolves.toBe('half-open');
    await expect(breaker.execute(async () => 'closed')).resolves.toBe('closed');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getStats().totalRequests).toBeGreaterThan(0);

    const rateBreaker = new CircuitBreaker({ failureThreshold: 10, successThreshold: 1, timeout: 1000, errorThreshold: 50 });
    await expect(rateBreaker.execute(async () => { throw new Error('rate'); })).rejects.toThrow('rate');
    await expect(rateBreaker.execute(async () => 'rate-recovery')).rejects.toThrow('OPEN');
    rateBreaker.reset();
    expect(rateBreaker.getState()).toBe(CircuitState.CLOSED);
    expect(rateBreaker.getStats()).toMatchObject({ failures: 0, successes: 0, totalRequests: 0 });
  });
});

describe('coverage-critical data and learning services', () => {
  it('covers knowledge graph indexing, queries, traversal, extraction, and statistics', async () => {
    const graph = new KnowledgeGraph();
    graph.addEntity({ id: 'a', name: 'Alice', type: 'person', properties: {} });
    graph.addEntity({ id: 'b', name: 'Bob', type: 'person', properties: {} });
    graph.addEntity({ id: 'c', name: 'City', type: 'place', properties: {} });
    graph.addRelationship({ id: 'r1', source: 'a', target: 'b', type: 'knows', properties: {}, confidence: 0.9 });
    graph.addRelationship({ id: 'r2', source: 'b', target: 'c', type: 'lives-in', properties: {}, confidence: 0.8 });
    expect(graph.queryEntities({ entityId: 'a' })).toHaveLength(1);
    expect(graph.queryEntities({ entityName: 'ALICE' })).toHaveLength(1);
    expect(graph.queryEntities({ limit: 2 })).toHaveLength(2);
    expect(graph.queryRelationships({ entityId: 'a' })).toHaveLength(1);
    expect(graph.queryRelationships({ entityId: 'b', relationshipType: 'lives-in' })).toHaveLength(1);
    expect(graph.queryRelationships({ relationshipType: 'knows' })).toHaveLength(1);
    expect(graph.findRelatedEntities('a', 3).map(entity => entity.id)).toEqual(['b', 'c']);

    const adapter = { generate: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        entities: [{ id: 'e1', name: 'Alice', type: 'Person' }],
        relationships: [{ id: 'x', source: 'e1', target: 'e2', type: 'knows' }],
      }),
    }) };
    await expect(graph.extractFromText('Alice knows Bob', adapter)).resolves.toEqual({
      entities: [{ id: 'e1', name: 'Alice', type: 'Person', properties: {} }],
      relationships: [{ id: 'x', source: 'e1', target: 'e2', type: 'knows', properties: {}, confidence: 0.5 }],
    });
    await expect(graph.extractFromText('bad', { generate: jest.fn().mockRejectedValue(new Error('no model')) })).resolves.toEqual({ entities: [], relationships: [] });
    expect(graph.getStats().entityTypes.get('person')).toBe(2);
    expect(graph.getStats().relationshipTypes.get('knows')).toBe(1);
  });

  it('covers feedback collection, callbacks, analytics, batches, and queries', async () => {
    const analytics = { recordFeedback: jest.fn() } as any;
    const collector = new FeedbackCollector(analytics);
    const callback = jest.fn().mockImplementationOnce(() => { throw new Error('callback'); });
    collector.onFeedback(callback);
    collector.collect(feedback({ rating: 5, thumbsUp: true, categories: ['helpful', 'fast'], messageContent: 'question', responseContent: 'answer' }));
    collector.collect(feedback({ rating: 1, thumbsDown: true, categories: ['accurate'], messageContent: 'q2', responseContent: 'a2', userId: 'user-2' }));
    collector.collect(feedback({ rating: 3, userId: 'user-3' }));
    expect(analytics.recordFeedback).toHaveBeenCalledTimes(3);
    await collector.flush();
    const stats = collector.getStats();
    expect(stats.processed).toBe(3);
    expect(stats.averageRating).toBe(3);
    expect(stats.positiveRate).toBeCloseTo(1 / 3);
    expect(stats.negativeRate).toBeCloseTo(1 / 3);
    expect(stats.topCategories[0]).toEqual({ category: 'helpful', count: 1 });
    expect(collector.getRecentFeedback(2)).toHaveLength(2);
    expect(collector.getFeedbackByUser('user-2')).toHaveLength(1);
    collector.setAnalyticsService({ recordFeedback: jest.fn() } as any);
  });

  it('covers TOON serialization helpers and JSON fallback-compatible APIs', async () => {
    const serializer = new ToonSerializer();
    const data = { name: 'Ada', values: [1, 2, 3] };
    const serialized = await serializer.serialize(data);
    expect(['toon', 'json']).toContain(serialized.format);
    expect(await serializer.deserialize(JSON.stringify(data))).toEqual(data);
    await expect(serializer.deserialize('not valid')).rejects.toThrow('Failed to deserialize');
    expect((await serializer.optimizeContext([{ content: 'hello', score: 0.9, source: 'test' }])).content).toBeDefined();
    expect((await serializer.optimizeChatHistory([{ role: 'assistant', content: 'hello' }, { role: 'user', content: 'hi' }, { role: 'system', content: 'rule' }])).content).toBeDefined();
    expect((await serializer.optimizeToolResults([{ tool: 'test', output: { ok: true }, success: true }])).content).toBeDefined();
    expect((await serializer.optimizeKnowledgeGraph([{ id: 'n1', type: 'thing', properties: {} }], [{ from: 'n1', to: 'n2', relation: 'knows' }])).content).toBeDefined();
    expect((await serializer.estimateSavings(data)).optimizedTokens).toBeGreaterThan(0);
    expect(await serializer.optimizeSystemPromptData(data)).toMatch(/<context format="(toon|json)">/);
    expect((await serializer.serializeBatch([data])).content).toBeDefined();
    expect(typeof await serializer.isAvailable()).toBe('boolean');
    expect(getToonSerializer()).toBe(getToonSerializer());
  });
});

describe('coverage-critical query enhancement', () => {
  it('covers NLP enhancement, cache hits, LLM enhancement, fallback, and intent helpers', async () => {
    const enhancer = new QueryEnhancer();
    const first = await enhancer.enhance('What is a great fast answer about Alice in Paris?', 'research');
    expect(first.original).toContain('Alice');
    expect(first.keywords).toContain('great');
    expect(await enhancer.enhance(first.original, 'research')).toBe(first);
    enhancer.clearCache();

    const llm = new QueryEnhancer({
      generate: jest.fn().mockResolvedValue({ content: '{"enhanced":"better query","keywords":"alpha, beta","intent":"informational","entities":"Ada","context":"test"}' }),
    } as any);
    const llmResult = await llm.enhance('Explain good software', 'coding');
    expect(llmResult.enhanced).toBe('better query');
    expect(llmResult.entities.some(entity => entity.text === 'Ada')).toBe(true);

    const fallback = new QueryEnhancer({ generate: jest.fn().mockRejectedValue(new Error('provider down')) } as any);
    await expect(fallback.enhance('Where is the best store?')).resolves.toMatchObject({ intent: 'informational' });

    const internal = enhancer as any;
    expect(internal.detectIntent('buy a product')).toBe('transactional');
    expect(internal.detectIntent('go to the store')).toBe('navigational');
    expect(internal.detectIntent('compare A versus B')).toBe('comparative');
    expect(internal.detectIntent('why is this useful')).toBe('informational');
    expect(internal.parseLLMResponse('{"ok":true}')).toEqual({ ok: true });
    expect(internal.parseLLMResponse('not-json')).toEqual({});
    expect(internal.mergeEntities([{ text: 'Ada', type: 'person' }], ['Ada', 'Paris'])).toHaveLength(2);
    expect(await internal.expandWithSynonyms('make it fast', ['make'])).toContain('create');
  });
});
