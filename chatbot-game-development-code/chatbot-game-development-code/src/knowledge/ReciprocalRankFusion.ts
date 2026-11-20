import type { EvidenceCandidate, EligibilityDecision, EligibilityPolicy } from './Eligibility';

export interface RankedEvidenceChannel {
  readonly name: string;
  /** Already relevance-ordered; upstream SQL must break score ties by chunk ID. */
  readonly items: readonly EvidenceCandidate[];
}

export interface RankContribution {
  readonly channel: string;
  readonly rank: number;
  readonly score: number;
}

export interface FusedEvidence {
  readonly candidate: Readonly<EvidenceCandidate>;
  readonly score: number;
  readonly eligibility: Extract<EligibilityDecision, { eligible: true }>;
  readonly contributions: readonly RankContribution[];
}

export interface FusionOptions {
  readonly limit?: number;
  readonly rankConstant?: number;
  readonly perChannelLimit?: number;
  /** All raw rows count, including rejected and duplicate candidates. */
  readonly maxScannedItems?: number;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function boundedInteger(value: number, field: string, minimum: number, maximum: number): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} is out of range`);
  }
}

/**
 * RRF = sum(1 / (rankConstant + eligibleRank)). Rejected and duplicate hits consume no rank.
 * This defensive pass cannot recover valid rows dropped by an upstream unfiltered SQL LIMIT.
 */
export function fuseEligibleRanks(
  channels: readonly RankedEvidenceChannel[],
  policy: EligibilityPolicy,
  options: FusionOptions = {},
): readonly FusedEvidence[] {
  const limit = options.limit ?? 10;
  const rankConstant = options.rankConstant ?? 60;
  const perChannelLimit = options.perChannelLimit ?? 100;
  const maxScannedItems = options.maxScannedItems ?? 10000;
  boundedInteger(limit, 'limit', 0, 10000);
  boundedInteger(rankConstant, 'rankConstant', 1, 1000000);
  boundedInteger(perChannelLimit, 'perChannelLimit', 1, 100000);
  boundedInteger(maxScannedItems, 'maxScannedItems', 1, 1000000);
  if (channels.length > 128) throw new RangeError('Too many retrieval channels');
  const seenChannels = new Set<string>();
  for (const channel of channels) {
    if (typeof channel.name !== 'string' || !channel.name.trim() || channel.name !== channel.name.trim()
        || channel.name.length > 128 || !Array.isArray(channel.items)) throw new TypeError('Invalid retrieval channel');
    if (seenChannels.has(channel.name)) throw new TypeError('Duplicate retrieval channel');
    seenChannels.add(channel.name);
  }
  if (limit === 0) return Object.freeze([]);
  const merged = new Map<string, {
    candidate: Readonly<EvidenceCandidate>;
    provenanceKey: string;
    score: number;
    eligibility: Extract<EligibilityDecision, { eligible: true }>;
    contributions: RankContribution[];
  }>();
  let scannedItems = 0;
  // Fixed accumulation order makes floating-point results independent of channel arrival order.
  for (const channel of [...channels].sort((a, b) => compareIds(a.name, b.name))) {
    let eligibleRank = 0;
    const seenChunkIds = new Set<string>();
    for (const item of channel.items) {
      if (eligibleRank >= perChannelLimit) break;
      if (++scannedItems > maxScannedItems) throw new RangeError('Raw retrieval scan budget exceeded');
      const decision = policy.evaluate(item);
      if (!decision.eligible) continue;
      const provenanceKey = JSON.stringify([item.corpusId, item.snapshotId, item.targetId, item.state, item.retrievalApproved]);
      const existing = merged.get(item.chunkId);
      if (existing && existing.provenanceKey !== provenanceKey) throw new TypeError('A chunk ID has conflicting provenance');
      if (seenChunkIds.has(item.chunkId)) continue;
      seenChunkIds.add(item.chunkId);
      eligibleRank += 1;
      if (eligibleRank > perChannelLimit) break;
      const contribution = 1 / (rankConstant + eligibleRank);
      const row = existing ?? {
        candidate: Object.freeze({
          chunkId: item.chunkId, corpusId: item.corpusId, snapshotId: item.snapshotId,
          targetId: item.targetId, state: item.state, retrievalApproved: item.retrievalApproved,
        }),
        provenanceKey, score: 0, eligibility: Object.freeze({ ...decision }), contributions: [],
      };
      row.score += contribution;
      row.contributions.push(Object.freeze({ channel: channel.name, rank: eligibleRank, score: contribution }));
      merged.set(item.chunkId, row);
    }
  }
  return Object.freeze([...merged.values()]
    .sort((a, b) => b.score - a.score || compareIds(a.candidate.chunkId, b.candidate.chunkId))
    .slice(0, limit)
    .map(row => Object.freeze({
      candidate: row.candidate, score: row.score, eligibility: row.eligibility,
      contributions: Object.freeze(row.contributions),
    })));
}
