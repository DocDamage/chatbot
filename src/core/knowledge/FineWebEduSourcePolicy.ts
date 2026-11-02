/**
 * FineWeb-Edu-Style Source Policy (CRK-P21-T01, T02, T03)
 *
 * Implements a quality-filtered ingestion pipeline for educational web content:
 * Language Detection -> Topic Classifier -> Quality Scorer -> Safety -> Deduplication.
 */

import { createHash } from 'crypto';
import {
  EducationalDocument,
  EducationalTopic,
  EducationalQualityScore,
  SupportedLanguageCode,
} from '../../types/educational-multilingual';

export interface RawWebDocument {
  id?: string;
  url?: string;
  title: string;
  rawText: string;
  declaredLanguage?: string;
  license?: string;
}

export interface IngestionFilterResult {
  accepted: boolean;
  document?: EducationalDocument;
  rejectionReason?: string;
}

const TOPIC_KEYWORDS: Record<EducationalTopic, RegExp[]> = {
  software: [/algorithm/i, /programming/i, /software/i, /compiler/i, /database/i, /network/i, /typescript/i, /python/i],
  science: [/physics/i, /chemistry/i, /biology/i, /astronomy/i, /experiment/i, /hypothesis/i, /molecule/i],
  engineering: [/circuit/i, /mechanical/i, /thermodynamics/i, /structural/i, /electrical/i, /robotics/i],
  history: [/century/i, /civilization/i, /war/i, /revolution/i, /empire/i, /treaty/i, /dynasty/i],
  general_education: [/curriculum/i, /lesson/i, /textbook/i, /course/i, /study guide/i, /tutorial/i, /primer/i],
};

const PROHIBITED_CONTENT = [/buy now/i, /casino/i, /viagra/i, /discount code/i, /sponsored post/i];

export class FineWebEduSourcePolicy {
  private readonly seenHashes = new Set<string>();

  constructor(public readonly qualityThreshold: number = 0.70) {}

  public processCandidate(candidate: RawWebDocument): IngestionFilterResult {
    const text = candidate.rawText.trim();
    if (text.length < 150) {
      return { accepted: false, rejectionReason: 'TOO_SHORT_UNDER_150_CHARS' };
    }

    for (const pattern of PROHIBITED_CONTENT) {
      if (pattern.test(text)) {
        return { accepted: false, rejectionReason: 'SAFETY_CONTENT_VIOLATION' };
      }
    }

    const language = this.detectLanguage(text, candidate.declaredLanguage);
    const topic = this.classifyTopic(text);
    if (!topic) {
      return { accepted: false, rejectionReason: 'TOPIC_NOT_EDUCATIONAL' };
    }

    const quality = this.scoreQuality(text);
    if (quality.score < this.qualityThreshold) {
      return {
        accepted: false,
        rejectionReason: `QUALITY_BELOW_THRESHOLD_${quality.score.toFixed(2)}_MIN_${this.qualityThreshold.toFixed(2)}`,
      };
    }

    const normalizedContent = text.toLowerCase().replace(/\s+/g, ' ');
    const contentHash = createHash('sha256').update(normalizedContent).digest('hex');
    if (this.seenHashes.has(contentHash)) {
      return { accepted: false, rejectionReason: 'EXACT_DUPLICATE_CONTENT' };
    }
    this.seenHashes.add(contentHash);

    const doc: EducationalDocument = {
      id: candidate.id || `edu-${contentHash.slice(0, 12)}`,
      url: candidate.url,
      title: candidate.title,
      content: text,
      topic,
      language,
      qualityScore: quality,
      license: candidate.license || 'Open-Web-Educational',
      extractedDate: new Date().toISOString(),
      contentHash,
    };

    return { accepted: true, document: doc };
  }

  public classifyTopic(text: string): EducationalTopic | null {
    let bestTopic: EducationalTopic | null = null;
    let maxMatches = 0;

    for (const [topic, patterns] of Object.entries(TOPIC_KEYWORDS)) {
      let matches = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) matches++;
      }
      if (matches > maxMatches && matches >= 1) {
        maxMatches = matches;
        bestTopic = topic as EducationalTopic;
      }
    }
    return bestTopic;
  }

  public detectLanguage(text: string, declared?: string): SupportedLanguageCode {
    if (declared && ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh', 'it'].includes(declared)) {
      return declared as SupportedLanguageCode;
    }
    if (/[áéíóúñ¿¡]/i.test(text)) return 'es';
    if (/[éèêëàâôûùç]/i.test(text)) return 'fr';
    if (/[äöüß]/i.test(text)) return 'de';
    if (/[\u3040-\u309F\u30A0-\u30FF]/i.test(text)) return 'ja';
    if (/[\u4E00-\u9FFF]/i.test(text)) return 'zh';
    return 'en';
  }

  public scoreQuality(text: string): EducationalQualityScore {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;

    const hasStructuredHeaders = /(?:^|\n)#{1,4}\s+\w+|(?:step\s+\d+|chapter\s+\d+)/i.test(text);
    const structureScore = Math.min(1, (hasStructuredHeaders ? 0.4 : 0.1) + Math.min(sentences.length / 10, 0.6));

    const clarity = (avgSentenceLength >= 8 && avgSentenceLength <= 30) ? 0.9 : 0.6;
    const hasEducationalKeywords = /(?:in summary|for example|definition|therefore|as a result|specifically)/i.test(text);
    const educationalValue = (hasEducationalKeywords ? 0.9 : 0.7);

    const score = Number(((structureScore * 0.3) + (clarity * 0.35) + (educationalValue * 0.35)).toFixed(2));
    return { score, educationalValue, clarity, structureScore };
  }
}
