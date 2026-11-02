export interface FreshnessDomainConfig {
  [domain: string]: number; // domain -> halfLifeDays
}

export const DEFAULT_DOMAIN_HALF_LIVES: Record<string, number> = {
  coding: 180,           // Software docs/frameworks decay rapidly (~6 months)
  coding_debug: 180,
  web_dev: 180,
  devops: 240,
  general_software: 365, // Standard technical reference (~1 year)
  science: 1095,         // Scientific research (~3 years)
  research: 1095,
  general_web: 60,       // News / ephemeral web (~2 months)
  history: 36500,        // Historical facts effectively do not decay (~100 years)
  math: 36500,           // Mathematical proofs do not decay
  encyclopedia: 3650     // Foundational encyclopedia (~10 years)
};

export class FreshnessScorer {
  private domainHalfLives: Map<string, number>;

  constructor(customHalfLives?: Record<string, number>) {
    this.domainHalfLives = new Map(Object.entries(DEFAULT_DOMAIN_HALF_LIVES));
    if (customHalfLives) {
      for (const [domain, days] of Object.entries(customHalfLives)) {
        if (typeof days === 'number' && days > 0) {
          this.domainHalfLives.set(domain.toLowerCase(), days);
        }
      }
    }
  }

  public getHalfLifeDays(domain?: string): number {
    if (!domain) return 365;
    return this.domainHalfLives.get(domain.toLowerCase()) ?? 365;
  }

  public computeFreshness(
    publishedAt?: string | Date | number,
    domain?: string,
    customHalfLifeDays?: number,
    referenceDate: Date = new Date()
  ): number {
    if (!publishedAt) {
      // Unknown publish date: neutral score (§1904-1910)
      return 0.50;
    }

    const pubDate = new Date(publishedAt);
    if (isNaN(pubDate.getTime())) {
      return 0.50;
    }

    const ageMs = referenceDate.getTime() - pubDate.getTime();
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    const halfLife = customHalfLifeDays && customHalfLifeDays > 0
      ? customHalfLifeDays
      : this.getHalfLifeDays(domain);

    // Exponential decay: exp(-ageDays / halfLifeDays) (§1907)
    const freshness = Math.exp(-ageDays / halfLife);
    return Math.min(1.0, Math.max(0.0, Number(freshness.toFixed(4))));
  }
}
