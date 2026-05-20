import { PhrasebookEntry } from './DomainPhrasebook';

export interface IntentCandidate {
  entry: PhrasebookEntry;
  score: number;
  matchedPhrases: string[];
}

export class IntentCandidateRanker {
  rank(message: string, entries: PhrasebookEntry[]): IntentCandidate[] {
    const normalized = this.normalize(message);
    return entries
      .map(entry => {
        const matchedPhrases = entry.phrases.filter(phrase => this.matchesPhrase(normalized, this.normalize(phrase)));
        const fuzzyMatches = entry.phrases.filter(phrase =>
          matchedPhrases.length === 0 && this.fuzzyPhraseMatch(normalized, this.normalize(phrase))
        );
        const allMatches = Array.from(new Set([...matchedPhrases, ...fuzzyMatches]));
        const score = this.score(normalized, entry, allMatches);
        return { entry, score, matchedPhrases: allMatches };
      })
      .filter(candidate => candidate.score > 0)
      .sort((a, b) => b.score - a.score || this.bestPhraseLength(b) - this.bestPhraseLength(a));
  }

  private score(message: string, entry: PhrasebookEntry, matchedPhrases: string[]): number {
    if (matchedPhrases.length === 0) return 0;
    const bestLength = Math.max(...matchedPhrases.map(phrase => phrase.length));
    const lengthScore = Math.min(0.25, bestLength / Math.max(message.length, 1));
    const base = entry.confidence ?? 0.8;
    return Math.min(0.98, base + lengthScore + Math.min(0.12, (matchedPhrases.length - 1) * 0.04));
  }

  private matchesPhrase(message: string, phrase: string): boolean {
    return message.includes(phrase);
  }

  private fuzzyPhraseMatch(message: string, phrase: string): boolean {
    const messageTokens = message.split(/\s+/);
    const phraseTokens = phrase.split(/\s+/);
    if (phraseTokens.length > 3) return false;

    return phraseTokens.every(phraseToken =>
      messageTokens.some(messageToken => this.levenshtein(messageToken, phraseToken) <= this.allowedDistance(phraseToken))
    );
  }

  private allowedDistance(token: string): number {
    return token.length <= 3 ? 0 : token.length <= 6 ? 1 : 2;
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^\w\s#]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private bestPhraseLength(candidate: IntentCandidate): number {
    return Math.max(0, ...candidate.matchedPhrases.map(phrase => phrase.length));
  }

  private levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  }
}
