/**
 * Unit Tests for BotProfileResolver (CRK-P02-T04)
 *
 * Verifies profile resolution priority hierarchy and security constraint enforcement.
 */

import { BotProfileResolver } from './BotProfileResolver';
import { BotProfileRepository } from './BotProfileRepository';
import { DEFAULT_BOT_PROFILE, CODING_BOT_PROFILE, RESEARCH_BOT_PROFILE } from './DefaultBotProfile';

describe('BotProfileResolver (CRK-P02-T04)', () => {
  let repo: BotProfileRepository;
  let resolver: BotProfileResolver;

  beforeEach(async () => {
    repo = new BotProfileRepository();
    await repo.saveProfile(DEFAULT_BOT_PROFILE, 'system');
    await repo.saveProfile(CODING_BOT_PROFILE, 'system');
    await repo.saveProfile(RESEARCH_BOT_PROFILE, 'system');
    resolver = new BotProfileResolver(repo);
  });

  it('prioritizes admin-enforced profile over all other context inputs', async () => {
    const resolved = await resolver.resolve({
      adminEnforcedProfileId: 'research',
      requestProfileId: 'coding',
      sessionProfileId: 'default',
      userPreferredProfileId: 'default',
    });

    expect(resolved.id).toBe('research');
  });

  it('resolves request profile when allowed and admin profile is absent', async () => {
    const resolved = await resolver.resolve({
      requestProfileId: 'coding',
      sessionProfileId: 'default',
      allowedProfileIds: ['coding', 'default'],
    });

    expect(resolved.id).toBe('coding');
  });

  it('ignores request profile when not in allowedProfileIds and falls back to session profile', async () => {
    const resolved = await resolver.resolve({
      requestProfileId: 'research',
      sessionProfileId: 'coding',
      allowedProfileIds: ['coding', 'default'],
    });

    expect(resolved.id).toBe('coding');
  });

  it('falls back to user preferred profile if request and session are empty', async () => {
    const resolved = await resolver.resolve({
      userPreferredProfileId: 'research',
    });

    expect(resolved.id).toBe('research');
  });

  it('falls back to default profile when no matching profile is specified', async () => {
    const resolved = await resolver.resolve({});
    expect(resolved.id).toBe('default');
  });

  it('enforces that security policy cannot be weakened by user-selected profile (§947)', async () => {
    await repo.saveProfile(
      {
        id: 'weak-profile',
        name: 'Weak Security Profile',
        citationPolicy: 'off',
      },
      'attacker'
    );

    const resolved = await resolver.resolve({
      requestProfileId: 'weak-profile',
      enforceMinimumSecurity: true,
    });

    expect(resolved.id).toBe('weak-profile');
    expect(resolved.citationPolicy).not.toBe('off');
  });
});
