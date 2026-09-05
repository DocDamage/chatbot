import { Request, Response } from 'express';
import { RateLimiter } from '../../middleware/rateLimiter';
import { RateLimitError, ServiceUnavailableError } from '../../utils/errors';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('RT-PLAT-004 / RT-SEC-002: RateLimiter Multi-Dimensional Security Suite', () => {
  it('identifies keys based on user, apiKey, session, ip, and forwarded headers', () => {
    const limiter = RateLimiter.create({ windowMs: 1000, maxRequests: 5 });
    const middleware = limiter.middleware();

    // 1. User ID priority
    const userReq = { user: { userId: 'usr-123' }, headers: {} } as unknown as Request;
    // 2. API Key priority
    const apiKeyReq = { apiKey: { id: 'key-456' }, headers: {} } as unknown as Request;
    // 3. Session priority
    const sessionReq = { body: { sessionId: 'sess-789' }, headers: {} } as unknown as Request;
    // 4. IP priority
    const ipReq = { ip: '192.168.1.1', headers: {} } as unknown as Request;
    // 5. Forwarded IP priority
    const fwdReq = { headers: { 'x-forwarded-for': '10.0.0.1' } } as unknown as Request;
    // 6. Unknown fallback
    const emptyReq = { headers: {} } as unknown as Request;

    const mockRes = () => {
      const headers: Record<string, string> = {};
      return {
        setHeader: (k: string, v: string) => { headers[k] = v; },
        headers
      } as unknown as Response;
    };

    const next = jest.fn();

    middleware(userReq, mockRes(), next);
    middleware(apiKeyReq, mockRes(), next);
    middleware(sessionReq, mockRes(), next);
    middleware(ipReq, mockRes(), next);
    middleware(fwdReq, mockRes(), next);
    middleware(emptyReq, mockRes(), next);

    expect(next).toHaveBeenCalledTimes(6);
  });

  it('enforces limit, calculates remaining, sets headers, and cleans up expired entries', async () => {
    const limiter = RateLimiter.create({ windowMs: 50, maxRequests: 2 });
    const middleware = limiter.middleware();
    const req = { ip: '1.2.3.4', headers: {} } as Request;

    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => { headers[k] = v; }
    } as Response;

    const next = jest.fn();

    // Request 1: OK, remaining 1
    await middleware(req, res, next);
    expect(next).toHaveBeenLastCalledWith();
    expect(headers['X-RateLimit-Limit']).toBe('2');
    expect(headers['X-RateLimit-Remaining']).toBe('1');
    expect(headers['X-RateLimit-Reset']).toBeDefined();

    // Request 2: OK, remaining 0
    await middleware(req, res, next);
    expect(next).toHaveBeenLastCalledWith();
    expect(headers['X-RateLimit-Remaining']).toBe('0');

    // Request 3: Blocked with RateLimitError
    await middleware(req, res, next);
    const lastError = (next as any).mock.calls[2][0];
    expect(lastError).toBeInstanceOf(RateLimitError);
    expect(lastError.statusCode).toBe(429);
    expect(lastError.message).toBe('Too many requests');

    // Trigger internal cleanup
    (limiter as any).cleanup();
  });

  it('enforces apiKey-specific custom rate limits', async () => {
    const limiter = RateLimiter.create({ windowMs: 10000, maxRequests: 100 });
    const middleware = limiter.middleware();
    const req = {
      apiKey: { id: 'custom-key', rateLimit: 1 },
      headers: {}
    } as unknown as Request;

    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn();

    // 1st request succeeds
    await middleware(req, res, next);
    expect(next).toHaveBeenLastCalledWith();

    // 2nd request exceeds apiKey limit (1)
    await middleware(req, res, next);
    const lastError = (next as any).mock.calls[1][0];
    expect(lastError).toBeInstanceOf(RateLimitError);
    expect(lastError.message).toBe('API key rate limit exceeded');
  });

  it('handles failOpen configuration on internal limiter errors', async () => {
    // failOpen: true
    const failOpenLimiter = RateLimiter.create({
      windowMs: 1000,
      maxRequests: 10,
      keyGenerator: () => { throw new Error('Key generator exploded'); },
      failOpen: true
    });
    const nextOpen = jest.fn();
    await failOpenLimiter.middleware()({ headers: {} } as Request, { setHeader: jest.fn() } as unknown as Response, nextOpen);
    expect(nextOpen).toHaveBeenCalledWith();

    // failOpen: false
    const failClosedLimiter = RateLimiter.create({
      windowMs: 1000,
      maxRequests: 10,
      keyGenerator: () => { throw new Error('Key generator exploded'); },
      failOpen: false
    });
    const nextClosed = jest.fn();
    await failClosedLimiter.middleware()({ headers: {} } as Request, { setHeader: jest.fn() } as unknown as Response, nextClosed);
    const err = (nextClosed as any).mock.calls[0][0];
    expect(err).toBeInstanceOf(ServiceUnavailableError);
    expect(err.statusCode).toBe(503);
  });

  it('supports Redis-backed distributed rate limiting and error fallback', async () => {
    const mockIncr = (jest.fn() as any)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    const mockPexpire = (jest.fn() as any).mockResolvedValue(1);
    const mockPttl = (jest.fn() as any).mockResolvedValue(5000);
    let errorHandler: ((err: any) => void) | undefined;

    const MockRedis = Redis as unknown as jest.MockedClass<typeof Redis>;
    MockRedis.mockImplementation(() => ({
      on: (event: string, cb: any) => {
        if (event === 'error') errorHandler = cb;
      },
      incr: mockIncr,
      pexpire: mockPexpire,
      pttl: mockPttl
    } as unknown as Redis));

    const redisLimiter = new RateLimiter(60000, 2, 'redis://localhost:6379');
    const middleware = redisLimiter.middleware();
    const req = { ip: '10.0.0.5', headers: {} } as Request;
    const res = { setHeader: jest.fn() } as unknown as Response;

    // 1st request (count = 1) -> pexpire called
    const next1 = jest.fn();
    await middleware(req, res, next1);
    expect(next1).toHaveBeenCalledWith();
    expect(mockPexpire).toHaveBeenCalled();

    // 2nd request (count = 2) -> pttl called
    const next2 = jest.fn();
    await middleware(req, res, next2);
    expect(next2).toHaveBeenCalledWith();
    expect(mockPttl).toHaveBeenCalled();

    // 3rd request (count = 3 > 2) -> RateLimitError
    const next3 = jest.fn();
    await middleware(req, res, next3);
    expect((next3 as any).mock.calls[0][0]).toBeInstanceOf(RateLimitError);

    // Redis error event triggers fallback to memory
    if (errorHandler) {
      errorHandler(new Error('Connection lost'));
    }
  });
});
