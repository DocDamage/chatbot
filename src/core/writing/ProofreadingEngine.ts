/**
 * Local Proofreading Engine (PX14-T05)
 *
 * Implements a local-first proofreading service covering spelling, grammar, punctuation,
 * style, personal dictionary, dismissed rules, and bounded chunking.
 */

import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { PersonalDictionary, ProofreadingCategory, ProofreadingSuggestion, TextRange } from './WritingTypes';

interface RuleDefinition {
  id: string;
  category: ProofreadingCategory;
  description: string;
  severity: 'info' | 'warning' | 'error';
  check: (text: string, offsetBase: number) => ProofreadingSuggestion[];
}

export class ProofreadingEngine {
  private personalDictionary: PersonalDictionary;
  private dismissedRuleIds: Set<string> = new Set();
  private language: string = 'en-US';

  // Common misspelled words dictionary for local spell checking
  private static readonly COMMON_MISSPELLINGS: Record<string, string[]> = {
    teh: ['the'],
    recieve: ['receive'],
    seperate: ['separate'],
    untill: ['until'],
    definately: ['definitely'],
    occured: ['occurred'],
    truely: ['truly'],
    wierd: ['weird'],
    goverment: ['government'],
    accomodate: ['accommodate'],
    acheive: ['achieve'],
    alot: ['a lot'],
    beleive: ['believe'],
    calender: ['calendar'],
    catagory: ['category'],
    collegue: ['colleague'],
    concious: ['conscious'],
    existance: ['existence'],
    foriegn: ['foreign'],
    guarentee: ['guarantee']
  };

  constructor(language: string = 'en-US') {
    this.language = language;
    this.personalDictionary = {
      words: new Set(),
      language
    };
  }

  /**
   * Returns provider health and local disclosure.
   */
  public getHealth(): {
    status: 'healthy' | 'degraded';
    provider: string;
    version: string;
    isLocalOnly: boolean;
    activeLanguage: string;
    dictionarySize: number;
  } {
    return {
      status: 'healthy',
      provider: 'LocalLanguageEngine (Clean-Room)',
      version: '1.4.0',
      isLocalOnly: true,
      activeLanguage: this.language,
      dictionarySize: this.personalDictionary.words.size
    };
  }

  /**
   * Adds custom word to personal dictionary.
   */
  public addToPersonalDictionary(word: string): void {
    this.personalDictionary.words.add(word.toLowerCase().trim());
  }

  /**
   * Removes word from personal dictionary.
   */
  public removeFromPersonalDictionary(word: string): void {
    this.personalDictionary.words.delete(word.toLowerCase().trim());
  }

  /**
   * Dismisses a specific rule ID for this session.
   */
  public dismissRule(ruleId: string): void {
    this.dismissedRuleIds.add(ruleId);
  }

  /**
   * Resets all dismissed rules.
   */
  public resetDismissedRules(): void {
    this.dismissedRuleIds.clear();
  }

  /**
   * Runs local proofreading scan on document text with bounded chunking.
   */
  public scanDocument(rawText: string, maxChunkSize: number = 50000): ProofreadingSuggestion[] {
    const suggestions: ProofreadingSuggestion[] = [];

    // Bounded chunking for large documents (e.g. 100k+ words)
    let chunkStart = 0;
    while (chunkStart < rawText.length) {
      let chunkEnd = Math.min(chunkStart + maxChunkSize, rawText.length);
      // Try to break at a paragraph or sentence boundary
      if (chunkEnd < rawText.length) {
        const nextBreak = rawText.indexOf('\n\n', chunkEnd - 500);
        if (nextBreak !== -1 && nextBreak < chunkEnd + 500) {
          chunkEnd = nextBreak + 2;
        }
      }

      const chunkText = rawText.substring(chunkStart, chunkEnd);
      const chunkSuggestions = this.scanChunk(chunkText, rawText, chunkStart);
      suggestions.push(...chunkSuggestions);

      chunkStart = chunkEnd;
    }

    return suggestions.filter((s) => !this.dismissedRuleIds.has(s.ruleId));
  }

  /**
   * Scans a single text chunk and calculates absolute document ranges.
   */
  private scanChunk(chunkText: string, fullText: string, offsetBase: number): ProofreadingSuggestion[] {
    const results: ProofreadingSuggestion[] = [];

    // 1. Spell Checking
    const wordRegex = /\b[A-Za-z]+(?:'[A-Za-z]+)?\b/g;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(chunkText)) !== null) {
      const originalWord = match[0];
      const lowerWord = originalWord.toLowerCase();

      // Check if known misspelling and not in personal dictionary
      if (
        ProofreadingEngine.COMMON_MISSPELLINGS[lowerWord] &&
        !this.personalDictionary.words.has(lowerWord)
      ) {
        const startOffset = offsetBase + match.index;
        const endOffset = startOffset + originalWord.length;
        const range = CanonicalDocumentModel.offsetToRange(fullText, startOffset, endOffset);
        const replacements = ProofreadingEngine.COMMON_MISSPELLINGS[lowerWord];

        results.push({
          id: `sugg-spell-${startOffset}`,
          category: 'spelling',
          message: `Possible spelling mistake found: "${originalWord}". Did you mean "${replacements[0]}"?`,
          range,
          originalText: originalWord,
          replacements,
          ruleId: 'SPELL_CHECK_COMMON',
          ruleDescription: 'Common misspellings rule',
          severity: 'error',
          dismissed: false
        });
      }
    }

    // 2. Repeated Consecutive Words (e.g. "the the")
    const repeatedRegex = /\b([A-Za-z]+)\s+\1\b/gi;
    while ((match = repeatedRegex.exec(chunkText)) !== null) {
      const fullMatch = match[0];
      const singleWord = match[1];
      const startOffset = offsetBase + match.index;
      const endOffset = startOffset + fullMatch.length;
      const range = CanonicalDocumentModel.offsetToRange(fullText, startOffset, endOffset);

      results.push({
        id: `sugg-repeat-${startOffset}`,
        category: 'grammar',
        message: `Repeated word: "${fullMatch}". Consider removing the duplicate word.`,
        range,
        originalText: fullMatch,
        replacements: [singleWord],
        ruleId: 'REPEATED_WORD',
        ruleDescription: 'Duplicate consecutive word detection',
        severity: 'warning',
        dismissed: false
      });
    }

    // 3. Punctuation Spacing (e.g. space before comma/period " , " or missing space after comma)
    const punctRegex = /\w\s+([,.;:!?])/g;
    while ((match = punctRegex.exec(chunkText)) !== null) {
      const punct = match[1];
      const startOffset = offsetBase + match.index;
      const endOffset = startOffset + match[0].length;
      const range = CanonicalDocumentModel.offsetToRange(fullText, startOffset, endOffset);
      const fixed = match[0].replace(/\s+([,.;:!?])/, '$1');

      results.push({
        id: `sugg-punct-${startOffset}`,
        category: 'punctuation',
        message: `Unexpected whitespace before punctuation "${punct}".`,
        range,
        originalText: match[0],
        replacements: [fixed],
        ruleId: 'PUNCTUATION_WHITESPACE_BEFORE',
        ruleDescription: 'Whitespace before punctuation mark',
        severity: 'info',
        dismissed: false
      });
    }

    // 4. Passive Voice Detection (e.g. "was written by", "is being created by")
    const passiveRegex = /\b(is|are|was|were|been|being)\s+([A-Za-z]+ed)\s+(by)\b/gi;
    while ((match = passiveRegex.exec(chunkText)) !== null) {
      const phrase = match[0];
      const startOffset = offsetBase + match.index;
      const endOffset = startOffset + phrase.length;
      const range = CanonicalDocumentModel.offsetToRange(fullText, startOffset, endOffset);

      results.push({
        id: `sugg-passive-${startOffset}`,
        category: 'passive_voice',
        message: `Passive voice detected: "${phrase}". Active voice often creates clearer sentences.`,
        range,
        originalText: phrase,
        replacements: [],
        ruleId: 'PASSIVE_VOICE_STYLE',
        ruleDescription: 'Passive voice usage warning',
        severity: 'info',
        dismissed: false
      });
    }

    // 5. Cliché / Wordy Phrases (e.g. "at this point in time" -> "now")
    const wordyPhrases: Record<string, string> = {
      'at this point in time': 'now',
      'in order to': 'to',
      'due to the fact that': 'because',
      'utilize': 'use',
      'for the purpose of': 'for'
    };

    for (const [phrase, replacement] of Object.entries(wordyPhrases)) {
      const pRegex = new RegExp(`\\b${phrase}\\b`, 'gi');
      while ((match = pRegex.exec(chunkText)) !== null) {
        const startOffset = offsetBase + match.index;
        const endOffset = startOffset + match[0].length;
        const range = CanonicalDocumentModel.offsetToRange(fullText, startOffset, endOffset);

        results.push({
          id: `sugg-wordy-${startOffset}`,
          category: 'style',
          message: `Wordy phrase "${match[0]}". Consider replacing with "${replacement}".`,
          range,
          originalText: match[0],
          replacements: [replacement],
          ruleId: 'STYLE_WORDY_PHRASE',
          ruleDescription: 'Conciseness and clarity improvement',
          severity: 'info',
          dismissed: false
        });
      }
    }

    return results;
  }
}
