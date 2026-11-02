/**
 * Bot Profile Resolution Service (CRK-P02-T04)
 *
 * Implements the canonical 5-tier profile resolution hierarchy (§938-948):
 * 1. Admin-enforced profile
 * 2. Explicit allowed profile from request/session
 * 3. Session profile
 * 4. User preference
 * 5. Default profile
 *
 * Enforces that user-selected profiles cannot weaken security or contract policies (§947).
 */

import { BotProfile } from '../../types/bot-profile';
import { BotProfileRepository } from './BotProfileRepository';
import { DEFAULT_BOT_PROFILE } from './DefaultBotProfile';

export interface ProfileResolutionContext {
  adminEnforcedProfileId?: string;
  requestProfileId?: string;
  sessionProfileId?: string;
  userPreferredProfileId?: string;
  allowedProfileIds?: string[];
  enforceMinimumSecurity?: boolean;
}

export class BotProfileResolver {
  constructor(private readonly repository: BotProfileRepository) {}

  public async resolve(context: ProfileResolutionContext): Promise<BotProfile> {
    // 1. Admin-enforced profile (highest priority)
    if (context.adminEnforcedProfileId) {
      const adminProfile = await this.repository.getProfile(context.adminEnforcedProfileId);
      if (adminProfile && adminProfile.enabled) {
        return adminProfile;
      }
    }

    // 2. Explicit allowed profile from request
    if (context.requestProfileId) {
      const isAllowed = !context.allowedProfileIds || context.allowedProfileIds.includes(context.requestProfileId);
      if (isAllowed) {
        const reqProfile = await this.repository.getProfile(context.requestProfileId);
        if (reqProfile && reqProfile.enabled) {
          return this.applySecurityConstraints(reqProfile, context);
        }
      }
    }

    // 3. Session profile
    if (context.sessionProfileId) {
      const sessProfile = await this.repository.getProfile(context.sessionProfileId);
      if (sessProfile && sessProfile.enabled) {
        return this.applySecurityConstraints(sessProfile, context);
      }
    }

    // 4. User preferred profile
    if (context.userPreferredProfileId) {
      const userProfile = await this.repository.getProfile(context.userPreferredProfileId);
      if (userProfile && userProfile.enabled) {
        return this.applySecurityConstraints(userProfile, context);
      }
    }

    // 5. Default profile fallback
    const repoDefault = (await this.repository.listProfiles()).find(p => p.isDefault && p.enabled);
    if (repoDefault) {
      return repoDefault;
    }

    return DEFAULT_BOT_PROFILE;
  }

  private applySecurityConstraints(
    profile: BotProfile,
    context: ProfileResolutionContext
  ): BotProfile {
    // Security policy cannot be weakened by user-selected profile (§947)
    if (context.enforceMinimumSecurity) {
      return {
        ...profile,
        systemPolicyId: profile.systemPolicyId || 'default-policy',
        citationPolicy: profile.citationPolicy === 'off' ? 'auto' : profile.citationPolicy,
      };
    }
    return profile;
  }
}
