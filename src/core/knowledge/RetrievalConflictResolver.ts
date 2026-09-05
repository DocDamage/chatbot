import {
  ScoredEvidence,
  ConflictRecord,
  VersionCompatibilityStatus
} from '../../types/retrieval-scoring';

export interface ConflictResolutionOutcome {
  preferred: ScoredEvidence[];
  conflicts: ConflictRecord[];
  hasMaterialUncertainty: boolean;
}

export class RetrievalConflictResolver {
  /**
   * Resolves conflicts between candidate evidence records according to §1973-1981:
   * 1. Prefer explicitly requested version
   * 2. Prefer more authoritative source
   * 3. Prefer current compatible version
   * 4. Retain conflict metadata
   * 5. Flag material uncertainty when conflict is unresolved/close
   */
  public resolveConflicts(
    scoredCandidates: ScoredEvidence[],
    topic: string = 'general'
  ): ConflictResolutionOutcome {
    if (scoredCandidates.length <= 1) {
      return {
        preferred: [...scoredCandidates],
        conflicts: [],
        hasMaterialUncertainty: false
      };
    }

    const conflicts: ConflictRecord[] = [];
    const suppressed = new Set<string>();

    for (let i = 0; i < scoredCandidates.length; i++) {
      for (let j = i + 1; j < scoredCandidates.length; j++) {
        const a = scoredCandidates[i];
        const b = scoredCandidates[j];

        // Check if candidates represent conflicting versions of the same product or topic
        const sameProduct = a.versionContext?.product &&
          b.versionContext?.product &&
          a.versionContext.product.toLowerCase() === b.versionContext.product.toLowerCase();

        if (sameProduct) {
          const aExact = a.versionStatus === VersionCompatibilityStatus.EXACT;
          const bExact = b.versionStatus === VersionCompatibilityStatus.EXACT;

          if (aExact && !bExact) {
            suppressed.add(b.id);
            conflicts.push({
              topic,
              preferredSourceUri: a.sourceUri,
              supersededSourceUri: b.sourceUri,
              preferredVersion: a.versionContext?.sourceVersion,
              supersededVersion: b.versionContext?.sourceVersion,
              reason: 'version_match',
              materialUncertainty: false,
              explanation: `Source ${a.sourceUri} exactly matches requested version.`
            });
            continue;
          } else if (!aExact && bExact) {
            suppressed.add(a.id);
            conflicts.push({
              topic,
              preferredSourceUri: b.sourceUri,
              supersededSourceUri: a.sourceUri,
              preferredVersion: b.versionContext?.sourceVersion,
              supersededVersion: a.versionContext?.sourceVersion,
              reason: 'version_match',
              materialUncertainty: false,
              explanation: `Source ${b.sourceUri} exactly matches requested version.`
            });
            continue;
          }

          // Incompatible / older version suppression
          const aIncompat = a.versionStatus === VersionCompatibilityStatus.KNOWN_INCOMPATIBLE ||
            a.versionStatus === VersionCompatibilityStatus.OLDER_MAJOR;
          const bIncompat = b.versionStatus === VersionCompatibilityStatus.KNOWN_INCOMPATIBLE ||
            b.versionStatus === VersionCompatibilityStatus.OLDER_MAJOR;

          if (bIncompat && !aIncompat) {
            suppressed.add(b.id);
            conflicts.push({
              topic,
              preferredSourceUri: a.sourceUri,
              supersededSourceUri: b.sourceUri,
              preferredVersion: a.versionContext?.sourceVersion,
              supersededVersion: b.versionContext?.sourceVersion,
              reason: 'version_match',
              materialUncertainty: false,
              explanation: `Superseding older/incompatible version ${b.versionContext?.sourceVersion} in favor of ${a.versionContext?.sourceVersion}.`
            });
            continue;
          }
        }

        // Close scores between disparate sources with authority gap
        const authDiff = Math.abs(a.breakdown.authorityScore - b.breakdown.authorityScore);
        const scoreDiff = Math.abs(a.breakdown.finalScore - b.breakdown.finalScore);

        if (scoreDiff < 0.05 && authDiff > 0.30) {
          // Material conflict between high authority and lower authority with similar score
          const preferred = a.breakdown.authorityScore > b.breakdown.authorityScore ? a : b;
          const lower = a.breakdown.authorityScore > b.breakdown.authorityScore ? b : a;

          conflicts.push({
            topic,
            preferredSourceUri: preferred.sourceUri,
            supersededSourceUri: lower.sourceUri,
            reason: 'higher_authority',
            materialUncertainty: true,
            explanation: `Close score between authoritative source ${preferred.sourceUri} and lower-tier source ${lower.sourceUri}.`
          });
        }
      }
    }

    const preferred = scoredCandidates.filter(c => !suppressed.has(c.id));
    const hasMaterialUncertainty = conflicts.some(c => c.materialUncertainty);

    return {
      preferred,
      conflicts,
      hasMaterialUncertainty
    };
  }
}
