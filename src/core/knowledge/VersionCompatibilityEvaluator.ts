import {
  VersionContext,
  VersionCompatibilityStatus,
  VERSION_COMPATIBILITY_SCORES
} from '../../types/retrieval-scoring';

export interface VersionEvaluationResult {
  status: VersionCompatibilityStatus;
  score: number;
  targetVersion?: string;
  sourceVersion?: string;
  reason: string;
}

export class VersionCompatibilityEvaluator {
  /**
   * Parse a version string into major, minor, patch numbers.
   */
  public static parseSemver(v?: string): { major?: number; minor?: number; patch?: number } {
    if (!v) return {};
    const match = v.trim().match(/^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/i);
    if (!match) return {};
    return {
      major: match[1] !== undefined ? parseInt(match[1], 10) : undefined,
      minor: match[2] !== undefined ? parseInt(match[2], 10) : undefined,
      patch: match[3] !== undefined ? parseInt(match[3], 10) : undefined
    };
  }

  /**
   * Evaluates version compatibility strictly adhering to §1928-1936.
   * Never pretends unknown is exact.
   */
  public evaluate(context?: VersionContext): VersionEvaluationResult {
    if (!context) {
      return {
        status: VersionCompatibilityStatus.UNKNOWN,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.UNKNOWN],
        reason: 'No version context provided'
      };
    }

    const target = context.requested?.trim() || context.projectDetected?.trim();
    const source = context.sourceVersion?.trim();

    if (!target || !source) {
      return {
        status: VersionCompatibilityStatus.UNKNOWN,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.UNKNOWN],
        targetVersion: target,
        sourceVersion: source,
        reason: 'Target or source version is unknown'
      };
    }

    // Exact string match
    if (target.toLowerCase() === source.toLowerCase()) {
      return {
        status: VersionCompatibilityStatus.EXACT,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.EXACT],
        targetVersion: target,
        sourceVersion: source,
        reason: `Exact version match (${target})`
      };
    }

    const targetParsed = VersionCompatibilityEvaluator.parseSemver(target);
    const sourceParsed = VersionCompatibilityEvaluator.parseSemver(source);

    if (targetParsed.major === undefined || sourceParsed.major === undefined) {
      return {
        status: VersionCompatibilityStatus.UNKNOWN,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.UNKNOWN],
        targetVersion: target,
        sourceVersion: source,
        reason: 'Unparseable version format'
      };
    }

    // Same major version
    if (targetParsed.major === sourceParsed.major) {
      if (targetParsed.minor === undefined || sourceParsed.minor === undefined) {
        return {
          status: VersionCompatibilityStatus.SAME_MAJOR_UNKNOWN_MINOR,
          score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.SAME_MAJOR_UNKNOWN_MINOR],
          targetVersion: target,
          sourceVersion: source,
          reason: `Same major version ${targetParsed.major}, unknown minor`
        };
      }

      // Exact major and minor match (e.g. 3.5 and 3.5.0)
      if (
        targetParsed.minor === sourceParsed.minor &&
        (targetParsed.patch === undefined ||
          sourceParsed.patch === undefined ||
          targetParsed.patch === sourceParsed.patch)
      ) {
        return {
          status: VersionCompatibilityStatus.EXACT,
          score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.EXACT],
          targetVersion: target,
          sourceVersion: source,
          reason: `Exact compatible version match (${targetParsed.major}.${targetParsed.minor})`
        };
      }

      return {
        status: VersionCompatibilityStatus.SAME_MAJOR_COMPATIBLE_MINOR,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.SAME_MAJOR_COMPATIBLE_MINOR],
        targetVersion: target,
        sourceVersion: source,
        reason: `Same major version ${targetParsed.major}, compatible minor`
      };
    }

    // Older major version (e.g. Godot 3 vs Godot 4.7)
    if (sourceParsed.major < targetParsed.major) {
      return {
        status: VersionCompatibilityStatus.OLDER_MAJOR,
        score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.OLDER_MAJOR],
        targetVersion: target,
        sourceVersion: source,
        reason: `Source major ${sourceParsed.major} is older than target major ${targetParsed.major}`
      };
    }

    // Newer major or incompatible
    return {
      status: VersionCompatibilityStatus.KNOWN_INCOMPATIBLE,
      score: VERSION_COMPATIBILITY_SCORES[VersionCompatibilityStatus.KNOWN_INCOMPATIBLE],
      targetVersion: target,
      sourceVersion: source,
      reason: `Source major ${sourceParsed.major} is incompatible with target major ${targetParsed.major}`
    };
  }
}
