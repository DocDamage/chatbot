/**
 * Structure-aware retrieval boosts for chunks produced by a structure-aware extractor (DABOOK).
 *
 * Both boosts are multiplicative and small, so they reorder near-ties without overriding the
 * lexical/dense fusion, and they are exactly zero for chunks without structure metadata, which
 * leaves ranking of every other source untouched.
 *
 * - breadcrumb boost: query terms that appear in the chapter/section path ("Using the Command
 *   Line" for a question about the command line) score up to +20%.
 * - code boost: for coding-style queries, chunks that contain code score +10%.
 */

import { RetrievalResult } from '../../types/rag';

export const BREADCRUMB_BOOST_MAX = 0.2;
export const CODE_BOOST = 0.1;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'what', 'how', 'does', 'this', 'that', 'from', 'about', 'which',
  'into', 'your', 'you', 'can', 'use', 'when', 'where', 'why', 'who', 'was', 'were', 'will'
]);

const CODING_QUERY = /\b(code|coding|function|command|commands|script|syntax|example|examples|snippet|compile|install|run|usage|cli|flag|flags|api|parameter|argument|sudo|bash|shell)\b|[`(){};$]/i;

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []).filter(token => !STOPWORDS.has(token));
}

export function isCodingQuery(query: string): boolean {
  return CODING_QUERY.test(query);
}

export function structureBoost(query: string, metadata: Record<string, any>): number {
  const breadcrumbs: unknown = metadata.breadcrumbs;
  let boost = 0;

  if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
    const queryTokens = [...new Set(tokens(query))];
    if (queryTokens.length > 0) {
      const trail = new Set(tokens(breadcrumbs.filter(part => typeof part === 'string').join(' ')));
      const hits = queryTokens.filter(token => trail.has(token)).length;
      boost += BREADCRUMB_BOOST_MAX * (hits / queryTokens.length);
    }
  }

  if (metadata.hasCode === true && isCodingQuery(query)) {
    boost += CODE_BOOST;
  }
  return boost;
}

export function applyStructureBoost(query: string, results: RetrievalResult[]): RetrievalResult[] {
  let changed = false;
  const boosted = results.map(result => {
    const boost = structureBoost(query, result.chunk.metadata ?? {});
    if (boost === 0) return result;
    changed = true;
    return {
      ...result,
      score: result.score * (1 + boost),
      retrievalMethod: result.retrievalMethod.includes('structure') ? result.retrievalMethod : `${result.retrievalMethod}+structure`
    };
  });
  // Array.prototype.sort is stable, so untouched results keep their relative order.
  return changed ? boosted.sort((a, b) => b.score - a.score) : results;
}
