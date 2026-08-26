/**
 * Semantic Architecture Card Provider (PX-04 / PX04-T03)
 *
 * Generates and preserves structured architecture cards for repository subsystems.
 * Contains plain-language subsystem purpose, exact source file digests, key symbols,
 * crux excerpts with source anchors, typed links between cards, entrypoints, routes,
 * data stores, and preserved human notes across regeneration.
 */

import { createHash } from 'crypto';

export interface CruxExcerpt {
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  sourceDigest: string;
  codeSnippet: string;
  explanation: string;
}

export interface ArchitectureCardLink {
  targetCardId: string;
  relationship: 'depends_on' | 'provides_api_to' | 'stores_in' | 'routes_to' | 'monitors';
  description?: string;
}

export interface SemanticArchitectureCard {
  id: string;
  subsystem: string;
  title: string;
  purpose: string;
  sourceFiles: Array<{ filePath: string; fileDigest: string; sizeBytes: number }>;
  keySymbols: Array<{ name: string; kind: string; signature?: string; filePath: string }>;
  cruxExcerpts: CruxExcerpt[];
  typedLinks: ArchitectureCardLink[];
  entrypoints: string[];
  routes?: string[];
  dataStores?: string[];
  tests: string[];
  configurationKeys?: string[];
  risksAndGotchas: string[];
  humanNotes?: string;
  generatedAt: string;
  contentHash: string;
}

export class SemanticArchitectureCardProvider {
  private cards = new Map<string, SemanticArchitectureCard>();

  public createCard(params: {
    subsystem: string;
    title: string;
    purpose: string;
    sourceFiles: Array<{ filePath: string; content: string }>;
    keySymbols: Array<{ name: string; kind: string; signature?: string; filePath: string }>;
    cruxExcerpts: CruxExcerpt[];
    typedLinks?: ArchitectureCardLink[];
    entrypoints?: string[];
    routes?: string[];
    dataStores?: string[];
    tests?: string[];
    configurationKeys?: string[];
    risksAndGotchas?: string[];
    humanNotes?: string;
  }): SemanticArchitectureCard {
    const cardId = `card_${params.subsystem.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

    // Preserve existing human notes if present and not overwritten
    const existing = this.cards.get(cardId);
    const humanNotes = params.humanNotes ?? existing?.humanNotes;

    const sourceFileRecords = params.sourceFiles.map(f => {
      const digest = createHash('sha256').update(Buffer.from(f.content, 'utf8')).digest('hex');
      return {
        filePath: f.filePath.replace(/\\/g, '/'),
        fileDigest: digest,
        sizeBytes: Buffer.byteLength(f.content, 'utf8')
      };
    });

    const rawPayload = JSON.stringify({
      subsystem: params.subsystem,
      title: params.title,
      purpose: params.purpose,
      sourceFiles: sourceFileRecords,
      keySymbols: params.keySymbols,
      cruxExcerpts: params.cruxExcerpts,
      typedLinks: params.typedLinks || []
    });
    const contentHash = createHash('sha256').update(rawPayload).digest('hex');

    const card: SemanticArchitectureCard = {
      id: cardId,
      subsystem: params.subsystem,
      title: params.title,
      purpose: params.purpose,
      sourceFiles: sourceFileRecords,
      keySymbols: params.keySymbols,
      cruxExcerpts: params.cruxExcerpts,
      typedLinks: params.typedLinks || [],
      entrypoints: params.entrypoints || [],
      routes: params.routes,
      dataStores: params.dataStores,
      tests: params.tests || [],
      configurationKeys: params.configurationKeys,
      risksAndGotchas: params.risksAndGotchas || [],
      humanNotes,
      generatedAt: new Date().toISOString(),
      contentHash
    };

    this.cards.set(cardId, card);
    return card;
  }

  public getCard(cardId: string): SemanticArchitectureCard | undefined {
    return this.cards.get(cardId);
  }

  public getAllCards(): SemanticArchitectureCard[] {
    return Array.from(this.cards.values());
  }

  public updateHumanNotes(cardId: string, notes: string): SemanticArchitectureCard {
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Architecture card '${cardId}' not found`);
    }
    card.humanNotes = notes;
    return card;
  }

  /**
   * Validate whether crux excerpts match the current source digest.
   */
  public validateCardFreshness(cardId: string, currentFileDigests: Map<string, string>): { isFresh: boolean; staleFiles: string[] } {
    const card = this.cards.get(cardId);
    if (!card) return { isFresh: false, staleFiles: [] };

    const staleFiles: string[] = [];
    for (const sf of card.sourceFiles) {
      const current = currentFileDigests.get(sf.filePath);
      if (current && current !== sf.fileDigest) {
        staleFiles.push(sf.filePath);
      }
    }

    return {
      isFresh: staleFiles.length === 0,
      staleFiles
    };
  }

  /**
   * Export architecture cards as a Mermaid diagram.
   */
  public exportToMermaid(): string {
    const lines: string[] = ['graph TD'];
    for (const card of this.cards.values()) {
      const safeId = card.id.replace(/[^A-Za-z0-9_]/g, '_');
      lines.push(`  ${safeId}["${card.title}<br/><i>${card.subsystem}</i>"]`);
      for (const link of card.typedLinks) {
        const safeTarget = link.targetCardId.replace(/[^A-Za-z0-9_]/g, '_');
        lines.push(`  ${safeId} -->|${link.relationship}| ${safeTarget}`);
      }
    }
    return lines.join('\n');
  }

  public clear(): void {
    this.cards.clear();
  }
}
