/**
 * Knowledge Router Engine (CRK-P08-T01, T02, T03, T04, T05)
 *
 * Implements domain-to-pack policies, user overrides, readiness verification,
 * live-web fallback controls, and routing telemetry.
 */

import {
  RoutingDomain,
  DomainRoutePolicy,
  UserKnowledgeOverridesInput,
  userKnowledgeOverridesSchema,
  RoutingDecision,
} from '../../types/knowledge-router';
import { KnowledgePackManager } from './KnowledgePackManager';

export const CANONICAL_DOMAIN_POLICIES: Record<RoutingDomain, DomainRoutePolicy> = {
  coding: {
    domain: 'coding',
    packPrecedence: ['core-official-docs', 'curated-code', 'developer-qa'],
    allowOnlineFallback: false,
    description: 'General programming implementation: official docs first, then code examples.',
  },
  coding_debug: {
    domain: 'coding_debug',
    packPrecedence: ['core-official-docs', 'developer-qa', 'curated-code'],
    allowOnlineFallback: true,
    description: 'Code debugging: official docs and developer Q&A for errors, web fallback if needed.',
  },
  repository: {
    domain: 'repository',
    packPrecedence: ['core-official-docs', 'curated-code'],
    allowOnlineFallback: false,
    description: 'Project repository tasks: official docs and project structure.',
  },
  game_dev: {
    domain: 'game_dev',
    packPrecedence: ['core-official-docs', 'developer-qa', 'curated-code'],
    allowOnlineFallback: false,
    description: 'Game development: engine docs (Godot, etc.), Q&A, and sample scripts.',
  },
  web_dev: {
    domain: 'web_dev',
    packPrecedence: ['core-official-docs', 'developer-qa', 'educational-web'],
    allowOnlineFallback: true,
    description: 'Web development: framework docs, developer Q&A, and tutorials.',
  },
  database: {
    domain: 'database',
    packPrecedence: ['core-official-docs', 'developer-qa'],
    allowOnlineFallback: false,
    description: 'Databases and SQL: official docs and verified Q&A.',
  },
  devops: {
    domain: 'devops',
    packPrecedence: ['core-official-docs', 'developer-qa'],
    allowOnlineFallback: true,
    description: 'CI/CD, containerization, and infrastructure tooling.',
  },
  general: {
    domain: 'general',
    packPrecedence: ['general-knowledge', 'research', 'educational-web'],
    allowOnlineFallback: true,
    description: 'General questions: encyclopedic reference, science, educational web.',
  },
  history: {
    domain: 'history',
    packPrecedence: ['general-knowledge', 'educational-web'],
    allowOnlineFallback: false,
    description: 'Historical facts and chronology.',
  },
  science: {
    domain: 'science',
    packPrecedence: ['research', 'general-knowledge'],
    allowOnlineFallback: true,
    description: 'Natural, physical, and computer sciences.',
  },
  research: {
    domain: 'research',
    packPrecedence: ['research', 'general-knowledge'],
    allowOnlineFallback: false,
    description: 'Peer-reviewed literature and academic papers.',
  },
  math: {
    domain: 'math',
    packPrecedence: ['math', 'research'],
    allowOnlineFallback: false,
    description: 'Formal mathematical proofs, theorems, and derivations.',
  },
  market: {
    domain: 'market',
    packPrecedence: ['general-knowledge', 'educational-web'],
    allowOnlineFallback: true,
    description: 'Business, finance, and market concepts.',
  },
  six_sigma: {
    domain: 'six_sigma',
    packPrecedence: ['general-knowledge', 'educational-web'],
    allowOnlineFallback: false,
    description: 'Quality management, process capability, and DMAIC.',
  },
  creative_reference: {
    domain: 'creative_reference',
    packPrecedence: ['general-knowledge', 'educational-web'],
    allowOnlineFallback: false,
    description: 'Creative and artistic references.',
  },
};

export class KnowledgeRouter {
  private readonly packManager: KnowledgePackManager;
  private readonly policies: Record<RoutingDomain, DomainRoutePolicy>;

  constructor(
    packManager: KnowledgePackManager = new KnowledgePackManager(),
    customPolicies?: Partial<Record<RoutingDomain, DomainRoutePolicy>>
  ) {
    this.packManager = packManager;
    this.policies = { ...CANONICAL_DOMAIN_POLICIES, ...customPolicies };
  }

  /**
   * Route a request to designated knowledge packs based on domain and overrides (§1787-1858)
   */
  public route(
    domain: RoutingDomain,
    rawOverrides?: UserKnowledgeOverridesInput,
    installedDatasetIds: string[] = ['official-docs-core', 'stackoverflow-curated', 'curated-code-snippets', 'encyclopedia-core', 'math-proofs-theorems', 'arxiv-summaries']
  ): RoutingDecision {
    const startTime = Date.now();
    const policy = this.policies[domain] ?? CANONICAL_DOMAIN_POLICIES.general;
    const candidates = [...policy.packPrecedence];

    let targetPacks = [...candidates];
    let overridesApplied = false;
    const overrides = rawOverrides ? userKnowledgeOverridesSchema.parse(rawOverrides) : undefined;

    // Apply user overrides (§1825-1839)
    if (overrides && overrides.mode === 'custom') {
      if (overrides.includePacks && overrides.includePacks.length > 0) {
        // Enforce user inclusion while keeping valid known packs
        const included = overrides.includePacks.filter(p => this.packManager.get(p));
        if (included.length > 0) {
          targetPacks = Array.from(new Set([...included, ...targetPacks]));
          overridesApplied = true;
        }
      }
      if (overrides.excludePacks && overrides.excludePacks.length > 0) {
        const excludeSet = new Set(overrides.excludePacks);
        targetPacks = targetPacks.filter(p => !excludeSet.has(p));
        overridesApplied = true;
      }
    }

    // Verify pack readiness and active status (§1840-1848)
    const selectedPacks: string[] = [];
    const unavailablePacks: string[] = [];

    for (const packId of targetPacks) {
      const pack = this.packManager.get(packId);
      if (!pack || !pack.enabled) {
        unavailablePacks.push(packId);
        continue;
      }

      const readiness = this.packManager.getReadiness(packId, installedDatasetIds);
      if (readiness.isReady) {
        selectedPacks.push(packId);
      } else {
        unavailablePacks.push(packId);
      }
    }

    // Determine web fallback (§1832, §1847)
    const userNoOnline = overrides?.noOnline === true;
    const allowWeb = !userNoOnline && policy.allowOnlineFallback;

    return {
      domain,
      candidatePacks: candidates,
      selectedPacks,
      unavailablePacks,
      allowWeb,
      overridesApplied,
      telemetry: {
        evaluatedAt: new Date().toISOString(),
        durationMs: Math.max(1, Date.now() - startTime),
        domain,
        requestedPacks: targetPacks,
        resolvedPacks: selectedPacks,
        missingPacks: unavailablePacks,
        noOnlinePreference: userNoOnline,
      },
    };
  }

  public getPolicy(domain: RoutingDomain): DomainRoutePolicy {
    return this.policies[domain];
  }
}
