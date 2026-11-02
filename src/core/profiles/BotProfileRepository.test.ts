/**
 * Unit Tests for BotProfileRepository (CRK-P02-T02)
 *
 * Verifies profile creation, automatic version incrementing, changed fields diffs,
 * version history retrieval, and rollback capability.
 */

import { BotProfileRepository } from './BotProfileRepository';

describe('BotProfileRepository (CRK-P02-T02)', () => {
  it('saves an initial profile at version 1 with audit history', async () => {
    const repo = new BotProfileRepository();

    const saved = await repo.saveProfile(
      {
        id: 'coding-assistant',
        name: 'Coding Assistant',
        responseStyle: 'adaptive',
        citationPolicy: 'always-when-grounded',
        enabled: true,
      },
      'system-initializer'
    );

    expect(saved.id).toBe('coding-assistant');
    expect(saved.version).toBe(1);
    expect(saved.createdAt).toBeDefined();

    const history = await repo.getVersionHistory('coding-assistant');
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe(1);
    expect(history[0].author).toBe('system-initializer');
    expect(history[0].changedFields).toEqual(['*']);
  });

  it('increments version and records changed fields diff on update', async () => {
    const repo = new BotProfileRepository();

    await repo.saveProfile(
      {
        id: 'customer-support',
        name: 'Support Bot',
        responseStyle: 'adaptive',
      },
      'author-1'
    );

    const updated = await repo.saveProfile(
      {
        id: 'customer-support',
        name: 'Support Bot (Updated)',
        responseStyle: 'concise',
      },
      'author-2'
    );

    expect(updated.version).toBe(2);
    expect(updated.name).toBe('Support Bot (Updated)');
    expect(updated.responseStyle).toBe('concise');

    const history = await repo.getVersionHistory('customer-support');
    expect(history).toHaveLength(2);
    expect(history[1].version).toBe(2);
    expect(history[1].previousVersion).toBe(1);
    expect(history[1].author).toBe('author-2');
    expect(history[1].changedFields).toEqual(expect.arrayContaining(['name', 'responseStyle']));
  });

  it('supports rollback to an earlier version with audit tracking', async () => {
    const repo = new BotProfileRepository();

    await repo.saveProfile({ id: 'rollback-bot', name: 'Version 1 Name', responseStyle: 'adaptive' }, 'admin');
    await repo.saveProfile({ id: 'rollback-bot', name: 'Version 2 Name', responseStyle: 'concise' }, 'admin');

    const rolledBack = await repo.rollbackToVersion('rollback-bot', 1, 'admin');

    expect(rolledBack.version).toBe(3);
    expect(rolledBack.responseStyle).toBe('adaptive');

    const history = await repo.getVersionHistory('rollback-bot');
    expect(history).toHaveLength(3);
    expect(history[2].version).toBe(3);
    expect(history[2].author).toContain('rollback');
  });
});
