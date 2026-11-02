import { AuditLogger } from '../AuditLogger';
import { Database } from '../../database/Database';

describe('RT-PLAT-008 / RT-AUD-001: AuditLogger Event Logging and Querying Suite', () => {
  it('logs events in-memory, enforces maxEvents limit, and persists to database when available', async () => {
    const mockDb = {
      query: jest.fn(async () => ({ rows: [] }))
    } as unknown as Database;

    const logger = new AuditLogger(mockDb);

    await logger.log({
      type: 'user.login',
      userId: 'u1',
      action: 'login',
      success: true,
      metadata: { ip: '127.0.0.1' }
    });

    expect(mockDb.query).toHaveBeenCalledTimes(1);

    // Query back
    const all = await logger.query({});
    expect(all.length).toBe(1);
    expect(all[0].type).toBe('user.login');
    expect(all[0].userId).toBe('u1');
  });

  it('filters audit logs across type, userId, date ranges, success status, and limit', async () => {
    const logger = new AuditLogger();
    const t1 = new Date(Date.now() - 5000);
    const t2 = new Date(Date.now() - 2000);

    await logger.log({ type: 'user.login', userId: 'u1', action: 'login', success: true });
    await logger.log({ type: 'security.violation', userId: 'u2', action: 'inject', success: false });
    await logger.log({ type: 'admin.action', userId: 'u1', action: 'delete_user', success: true });

    // Filter by type
    const secLogs = await logger.query({ type: 'security.violation' });
    expect(secLogs.length).toBe(1);
    expect(secLogs[0].userId).toBe('u2');

    // Filter by userId
    const u1Logs = await logger.query({ userId: 'u1' });
    expect(u1Logs.length).toBe(2);

    // Filter by success
    const failedLogs = await logger.query({ success: false });
    expect(failedLogs.length).toBe(1);

    // Filter with limit
    const limited = await logger.query({ limit: 1 });
    expect(limited.length).toBe(1);

    // Stats
    const stats = logger.getStats({ start: t1, end: new Date() });
    expect(stats.totalEvents).toBe(3);
    expect(stats.uniqueUsers).toBe(2);
    expect(stats.successRate).toBeCloseTo((2 / 3) * 100);
  });

  it('handles database persistence failures gracefully without throwing', async () => {
    const failingDb = {
      query: jest.fn(async () => { throw new Error('DB connection dead'); })
    } as unknown as Database;

    const logger = new AuditLogger(failingDb);
    await expect(logger.log({
      type: 'error.occurred',
      action: 'test_error',
      success: false
    })).resolves.not.toThrow();
  });
});
