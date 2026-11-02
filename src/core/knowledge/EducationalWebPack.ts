/**
 * Educational Web Knowledge Pack (CRK-P21-T01, T02, T03)
 *
 * Manages ingestion, staging, and topic-bounded retrieval for curated educational web sources.
 * Adheres to authority score 0.70 and domain segregation rules.
 */

import { EducationalDocument, EducationalTopic } from '../../types/educational-multilingual';
import { FineWebEduSourcePolicy, RawWebDocument } from './FineWebEduSourcePolicy';

export interface EducationalRetrievalResult {
  docId: string;
  title: string;
  content: string;
  topic: EducationalTopic;
  score: number;
  quality: number;
  authority: number;
}

export class EducationalWebPack {
  public readonly packId = 'educational-web';
  public readonly authority = 0.70;
  private readonly documents = new Map<string, EducationalDocument>();
  private readonly stagingDocuments = new Map<string, EducationalDocument>();
  private readonly policy: FineWebEduSourcePolicy;

  constructor(qualityThreshold: number = 0.70) {
    this.policy = new FineWebEduSourcePolicy(qualityThreshold);
  }

  public ingestDocument(raw: RawWebDocument, stageOnly = false): { success: boolean; reason?: string } {
    const res = this.policy.processCandidate(raw);
    if (!res.accepted || !res.document) {
      return { success: false, reason: res.rejectionReason };
    }
    if (stageOnly) {
      this.stagingDocuments.set(res.document.id, res.document);
    } else {
      this.documents.set(res.document.id, res.document);
    }
    return { success: true };
  }

  public promoteStagedDocument(docId: string): boolean {
    const doc = this.stagingDocuments.get(docId);
    if (!doc) return false;
    this.stagingDocuments.delete(docId);
    this.documents.set(doc.id, doc);
    return true;
  }

  public query(queryText: string, topicFilter?: EducationalTopic, limit = 5): EducationalRetrievalResult[] {
    const queryTokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const results: EducationalRetrievalResult[] = [];

    for (const doc of this.documents.values()) {
      if (topicFilter && doc.topic !== topicFilter) {
        continue;
      }
      const textLower = (doc.title + ' ' + doc.content).toLowerCase();
      let matchScore = 0;
      for (const token of queryTokens) {
        if (textLower.includes(token)) matchScore += 1;
      }
      if (matchScore > 0) {
        const relevance = Math.min(1.0, matchScore / queryTokens.length);
        results.push({
          docId: doc.id,
          title: doc.title,
          content: doc.content,
          topic: doc.topic,
          score: relevance,
          quality: doc.qualityScore.score,
          authority: this.authority,
        });
      }
    }

    return results
      .sort((a, b) => (b.score * b.quality) - (a.score * a.quality))
      .slice(0, limit);
  }

  public getDocumentCount(): { live: number; staged: number } {
    return {
      live: this.documents.size,
      staged: this.stagingDocuments.size,
    };
  }
}
