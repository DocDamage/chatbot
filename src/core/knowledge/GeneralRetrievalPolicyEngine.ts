import {
  GeneralQueryCategory,
  GeneralSourceTier,
  GeneralRetrievalPolicyConfig,
  SnapshotMetadata,
  TemporalAnalysisResult,
  GeneralRetrievalPlan,
} from '../../types/general-retrieval-policy';

export class GeneralRetrievalPolicyEngine {
  private config: GeneralRetrievalPolicyConfig;

  private static readonly DEFAULT_TIME_INDICATORS = [
    'latest', 'current', 'currently', 'recent', 'recently', 'now',
    'today', 'this year', 'upcoming', 'newest', 'updated', 'breaking',
  ];

  private static readonly DEFAULT_SCIENTIFIC_INDICATORS = [
    'quantum', 'physics', 'chemistry', 'biology', 'astronomy', 'genetics',
    'neuroscience', 'peer-reviewed', 'hypothesis', 'clinical trial',
    'relativity', 'thermodynamics', 'molecular', 'superconductivity',
  ];

  constructor(config?: Partial<GeneralRetrievalPolicyConfig>) {
    this.config = {
      allowOnlineRetrieval: config?.allowOnlineRetrieval ?? false,
      timeSensitivityKeywords: config?.timeSensitivityKeywords ?? GeneralRetrievalPolicyEngine.DEFAULT_TIME_INDICATORS,
      scientificKeywords: config?.scientificKeywords ?? GeneralRetrievalPolicyEngine.DEFAULT_SCIENTIFIC_INDICATORS,
      maxStalenessDaysBeforeWarning: config?.maxStalenessDaysBeforeWarning ?? 180,
    };
  }

  public analyzeTemporal(query: string, referenceYear?: number): TemporalAnalysisResult {
    const lower = query.toLowerCase();
    const foundIndicators: string[] = [];

    const keywords = this.config.timeSensitivityKeywords || GeneralRetrievalPolicyEngine.DEFAULT_TIME_INDICATORS;
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower)) {
        foundIndicators.push(kw);
      }
    }

    // Check for year references (e.g. 2024, 2025, 2026)
    const yearMatch = query.match(/\b(20\d{2})\b/);
    const requestedYear = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    const currentYear = referenceYear ?? new Date().getFullYear();
    const isRecentOrFutureYear = requestedYear !== undefined && requestedYear >= currentYear - 1;

    const isTimeSensitive = foundIndicators.length > 0 || isRecentOrFutureYear;

    return {
      isTimeSensitive,
      temporalIndicators: foundIndicators,
      requestedYear,
    };
  }

  public classifyQuery(query: string, temporal: TemporalAnalysisResult): GeneralQueryCategory {
    if (temporal.isTimeSensitive) {
      return 'time_sensitive_fact';
    }

    const lower = query.toLowerCase();
    const scientificKeywords = this.config.scientificKeywords || GeneralRetrievalPolicyEngine.DEFAULT_SCIENTIFIC_INDICATORS;
    for (const kw of scientificKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower)) {
        return 'scientific_question';
      }
    }

    return 'normal_fact';
  }

  public determineSourceOrder(
    category: GeneralQueryCategory,
    allowOnline: boolean
  ): GeneralSourceTier[] {
    switch (category) {
      case 'scientific_question':
        return [
          'research_papers',
          'structured_knowledge',
          'encyclopedia',
          'authoritative_domain',
          'broader_sources',
        ];

      case 'time_sensitive_fact':
        if (allowOnline) {
          return [
            'live_web',
            'authoritative_domain',
            'structured_knowledge',
            'encyclopedia',
            'broader_sources',
          ];
        }
        return [
          'authoritative_domain',
          'structured_knowledge',
          'encyclopedia',
          'broader_sources',
        ];

      case 'normal_fact':
      default:
        return [
          'structured_knowledge',
          'encyclopedia',
          'authoritative_domain',
          'broader_sources',
        ];
    }
  }

  public createPlan(query: string, snapshot?: SnapshotMetadata): GeneralRetrievalPlan {
    const temporal = this.analyzeTemporal(query);
    const category = this.classifyQuery(query, temporal);
    const sourceOrder = this.determineSourceOrder(category, this.config.allowOnlineRetrieval);

    let freshnessDisclosureRequired = false;
    let disclosureMessage: string | undefined;

    // §51.4 No false freshness invariant:
    // If query is time-sensitive or asks for 'latest', but online retrieval is not used/allowed,
    // or if a snapshot is older than the staleness threshold, require disclosure.
    if (temporal.isTimeSensitive && !this.config.allowOnlineRetrieval) {
      freshnessDisclosureRequired = true;
      const snapshotInfo = snapshot
        ? `static snapshot ${snapshot.snapshotId} (cutoff: ${snapshot.cutoffDate})`
        : 'installed static knowledge datasets';
      disclosureMessage = `[Freshness Notice]: This query references recent or time-sensitive events, but answers are retrieved from ${snapshotInfo}. Information may not reflect the latest developments.`;
    } else if (snapshot) {
      const cutoff = new Date(snapshot.cutoffDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > this.config.maxStalenessDaysBeforeWarning && temporal.isTimeSensitive) {
        freshnessDisclosureRequired = true;
        disclosureMessage = `[Freshness Notice]: Static snapshot ${snapshot.snapshotId} is ${diffDays} days old (cutoff: ${snapshot.cutoffDate}).`;
      }
    }

    return {
      query,
      category,
      preferredSourceOrder: sourceOrder,
      temporalAnalysis: temporal,
      onlineRetrievalRecommended: temporal.isTimeSensitive && this.config.allowOnlineRetrieval,
      freshnessDisclosureRequired,
      disclosureMessage,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
