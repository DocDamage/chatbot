import { AuditLogger } from '../AuditLogger';

describe('RT-PLAT-008 — Secret, Log, Audit, and Support-Bundle Redaction Suite', () => {
  it('logs security violations and administrative actions with metadata', async () => {
    const audit = new AuditLogger();
    await audit.log({
      type: 'security.violation',
      userId: 'user-attacker',
      action: 'unauthorized_file_access',
      resource: '/sensitive/config.env',
      success: false,
      metadata: { reason: 'Path traversal attempt blocked' },
    });

    const events = await audit.query({ type: 'security.violation' });
    expect(events.length).toBe(1);
    expect(events[0].action).toBe('unauthorized_file_access');
    expect(events[0].success).toBe(false);
  });

  it('computes stats over event time windows', async () => {
    const audit = new AuditLogger();
    const now = new Date();
    await audit.log({
      type: 'admin.action',
      userId: 'admin-1',
      action: 'pack_installed',
      success: true,
    });
    await audit.log({
      type: 'api_key.create',
      userId: 'admin-1',
      action: 'created_api_key',
      success: true,
    });

    const stats = audit.getStats({
      start: new Date(now.getTime() - 10000),
      end: new Date(now.getTime() + 10000),
    });

    expect(stats.totalEvents).toBe(2);
    expect(stats.successRate).toBe(100);
    expect(stats.uniqueUsers).toBe(1);
  });
});
