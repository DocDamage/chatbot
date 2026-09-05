/**
 * General Knowledge Pack (CRK Phase 19: CRK-P19-T01 to T05)
 *
 * Coordinates Wikipedia section chunks and structured Wikidata entities.
 * Enforces baseline authority 0.67 (SourceAuthorityTier.ENCYCLOPEDIA)
 * and independent installability (§3128).
 */

import {
  WikipediaArticle,
  WikipediaSectionChunk,
  WikidataEntity,
  GeneralKnowledgeSnapshot,
} from '../../types/general-knowledge';
import { WikipediaChunker, RawWikipediaArticleInput } from './WikipediaChunker';
import { WikidataStructuredStore } from './WikidataStructuredStore';
import { EntityLinkingService } from './EntityLinkingService';

export class GeneralKnowledgePack {
  public readonly packId = 'general-knowledge';
  private enabled = true;
  private chunker: WikipediaChunker;
  private wikidataStore: WikidataStructuredStore;
  private linkingService: EntityLinkingService;

  private articles: Map<string, WikipediaArticle> = new Map();
  private chunks: Map<string, WikipediaSectionChunk> = new Map();
  private snapshotMeta?: GeneralKnowledgeSnapshot;

  constructor(
    wikidataStore?: WikidataStructuredStore,
    linkingService?: EntityLinkingService,
    chunker?: WikipediaChunker
  ) {
    this.wikidataStore = wikidataStore || new WikidataStructuredStore();
    this.linkingService =
      linkingService || new EntityLinkingService(this.wikidataStore);
    this.chunker = chunker || new WikipediaChunker();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setSnapshotMetadata(meta: GeneralKnowledgeSnapshot): void {
    this.snapshotMeta = meta;
  }

  public getSnapshotMetadata(): GeneralKnowledgeSnapshot | undefined {
    return this.snapshotMeta;
  }

  public getWikidataStore(): WikidataStructuredStore {
    return this.wikidataStore;
  }

  public indexWikidataEntity(entity: WikidataEntity): void {
    this.wikidataStore.ingestEntity(entity);
  }

  public indexWikipediaArticle(input: RawWikipediaArticleInput): WikipediaArticle {
    // Check entity linking if not explicitly provided
    let entityId = input.wikidataEntityId;
    if (!entityId) {
      const link = this.linkingService.linkMention(input.title, {
        summary: input.rawWikitextOrMarkdown.slice(0, 500),
      });
      if (link.isLinked) {
        entityId = link.entityId;
      }
    }

    const article = this.chunker.chunkArticle({
      ...input,
      wikidataEntityId: entityId,
    });

    this.articles.set(article.articleId, article);
    for (const section of article.sections) {
      this.chunks.set(section.chunkId, section);
    }

    return article;
  }

  public getSection(chunkId: string): WikipediaSectionChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public getAllSections(): WikipediaSectionChunk[] {
    return Array.from(this.chunks.values());
  }

  public search(query: string, limit = 5): WikipediaSectionChunk[] {
    if (!this.enabled) return [];

    const normalized = query.toLowerCase();
    const keywords = normalized.split(/\s+/).filter((k) => k.length >= 3);
    if (keywords.length === 0) return [];

    const matches: Array<{ chunk: WikipediaSectionChunk; score: number }> = [];

    for (const chunk of this.chunks.values()) {
      const text = `${chunk.articleTitle} ${chunk.sectionTitle} ${chunk.content}`.toLowerCase();
      let matchCount = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) matchCount++;
      }

      if (matchCount > 0) {
        // Boost lead sections and title matches
        let score = (matchCount / keywords.length) * chunk.authority;
        if (chunk.leadParagraph) score += 0.15;
        if (chunk.articleTitle.toLowerCase().includes(normalized)) score += 0.25;
        matches.push({ chunk, score });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit).map((m) => m.chunk);
  }
}
