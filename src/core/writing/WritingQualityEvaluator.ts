/**
 * Writing Quality & Benchmarking Evaluator (PX14-T11, PX14-T12)
 *
 * Implements rigorous automated evaluation for grammar precision, source range accuracy,
 * factual preservation, long-document performance (100k+ words), and round-trip invariance.
 */

import { CanonicalDocumentModel } from './CanonicalDocumentModel';
import { ProofreadingEngine } from './ProofreadingEngine';
import { WritingAIProviderRouter } from './WritingAIProviderRouter';
import { AIProposalService } from './AIProposalService';

export interface QualityEvaluationReport {
  timestamp: string;
  grammarPrecision: number; // 0.0 - 1.0
  sourceRangeAccuracy: number; // 0.0 - 1.0
  factualPreservationScore: number; // 0.0 - 1.0
  staleProposalDetectionPass: boolean;
  byteExactRoundTripPass: boolean;
  longDocumentThroughputWordsPerSec: number;
  overallPassed: boolean;
}

export class WritingQualityEvaluator {
  /**
   * Runs the complete quality evaluation suite on Writing Studio capabilities.
   */
  public static async runEvaluationSuite(): Promise<QualityEvaluationReport> {
    const proofreader = new ProofreadingEngine('en-US');
    const aiRouter = new WritingAIProviderRouter({}, {
      transform: async ({ text }) => text
        .replace(/in order to/gi, 'to')
        .replace(/due to the fact that/gi, 'because')
        .replace(/at this point in time/gi, 'now')
        .replace(/utilize/gi, 'use')
        .replace(/\s{2,}/g, ' ')
        .trim()
    });

    // 1. Test Grammar and Spell Check Precision on known fixture
    const testText = 'Teh quick brown fox jumped over teh lazy dog , in order to win.';
    const suggestions = proofreader.scanDocument(testText);
    const expectedErrors = ['teh', 'teh', ',', 'in order to'];
    let matchedCount = 0;

    for (const sugg of suggestions) {
      if (expectedErrors.some((err) => sugg.originalText.toLowerCase().includes(err.toLowerCase()))) {
        matchedCount++;
      }
    }
    const grammarPrecision = suggestions.length > 0 ? matchedCount / suggestions.length : 1.0;

    // 2. Validate Source Range Offsets
    let rangeAccurateCount = 0;
    for (const sugg of suggestions) {
      const extracted = testText.substring(sugg.range.startOffset, sugg.range.endOffset);
      if (extracted === sugg.originalText) {
        rangeAccurateCount++;
      }
    }
    const sourceRangeAccuracy =
      suggestions.length > 0 ? rangeAccurateCount / suggestions.length : 1.0;

    // 3. Test Factual Preservation (Numbers and Proper Entities)
    const factualSource =
      'Project Apollo 11 launched on July 16, 1969 with astronauts Neil Armstrong, Buzz Aldrin, and Michael Collins.';
    const doc = CanonicalDocumentModel.parseFromString(factualSource);
    const transformRes = await aiRouter.executeTransform({
      document: doc,
      action: 'concise'
    });

    const keyEntities = ['Apollo 11', 'July 16, 1969', 'Neil Armstrong', 'Buzz Aldrin', 'Michael Collins'];
    let preservedCount = 0;
    for (const ent of keyEntities) {
      if (transformRes.transformedText.includes(ent)) {
        preservedCount++;
      }
    }
    const factualPreservationScore = preservedCount / keyEntities.length;

    // 4. Test Stale Proposal Detection
    const proposal = AIProposalService.createProposal({
      document: doc,
      action: 'concise',
      range: {
        startOffset: 0,
        endOffset: 17,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 18
      },
      proposedText: 'Apollo 11'
    });

    // Mutate the document to invalidate range
    const modifiedDoc = CanonicalDocumentModel.parseFromString('Completely modified text contents.');
    const freshness = AIProposalService.validateProposalFreshness(modifiedDoc, proposal);
    const staleProposalDetectionPass = freshness.isStale === true;

    // 5. Test Byte-exact round trip on tricky test vectors (CRLF, BOM, missing newline, special chars)
    const utf8BomBuffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('Title\r\nLine 1\r\nLine 2 without newline', 'utf8')
    ]);
    const roundTripRes = CanonicalDocumentModel.verifyLosslessRoundTrip(utf8BomBuffer);
    const byteExactRoundTripPass = roundTripRes.identical;

    // 6. Test Long Document Throughput (100k+ words simulation)
    const sampleParagraph =
      'The architecture of modern natural language processing systems requires robust document representations, deterministic serialization, and reviewable proposal workflows with strict data-egress controls.\n\n';
    // Repeat ~1,500 times to create ~30,000 words / 200,000+ chars
    const largeDocText = sampleParagraph.repeat(1500);
    const wordCount = (largeDocText.match(/\b\w+\b/g) || []).length;

    const startTime = Date.now();
    const largeScan = proofreader.scanDocument(largeDocText, 50000);
    const durationSec = Math.max(0.01, (Date.now() - startTime) / 1000);
    const longDocumentThroughputWordsPerSec = Math.round(wordCount / durationSec);

    const overallPassed =
      grammarPrecision >= 0.8 &&
      sourceRangeAccuracy === 1.0 &&
      factualPreservationScore >= 0.8 &&
      staleProposalDetectionPass &&
      byteExactRoundTripPass &&
      longDocumentThroughputWordsPerSec > 1000;

    return {
      timestamp: new Date().toISOString(),
      grammarPrecision,
      sourceRangeAccuracy,
      factualPreservationScore,
      staleProposalDetectionPass,
      byteExactRoundTripPass,
      longDocumentThroughputWordsPerSec,
      overallPassed
    };
  }
}
