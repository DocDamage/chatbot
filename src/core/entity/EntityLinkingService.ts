import { createHash } from 'crypto';
import { Database } from '../database/Database';

export type LinkedEntityType =
  | 'person'
  | 'organization'
  | 'place'
  | 'software'
  | 'date'
  | 'concept'
  | 'ticker'
  | 'unknown';

export interface LinkedEntity {
  id: string;
  label: string;
  normalized: string;
  type: LinkedEntityType;
  aliases: string[];
  confidence: number;
  startIndex: number;
  endIndex: number;
  source: 'regex' | 'alias' | 'phrasebook';
}

export interface EntityLinkingResult {
  text: string;
  entities: LinkedEntity[];
  facets: {
    years: number[];
    software: string[];
    people: string[];
    concepts: string[];
  };
}

const SOFTWARE_ALIASES: Record<string, string[]> = {
  'fl_studio': ['fl studio', 'fruity loops', 'flstudio', 'flp'],
  'logic_pro': ['logic pro', 'logic pro x', 'logic x'],
  'pro_tools': ['pro tools', 'protools', 'pt'],
  'suno': ['suno'],
  'ollama': ['ollama'],
  'openai': ['openai', 'chatgpt', 'gpt'],
  'anthropic': ['anthropic', 'claude'],
  'gemini': ['gemini', 'google gemini'],
  'grok': ['grok', 'xai']
};

const CONCEPT_ALIASES: Record<string, string[]> = {
  'retrieval_augmented_generation': ['rag', 'retrieval augmented generation', 'knowledge base'],
  'knowledge_graph': ['knowledge graph', 'entity graph', 'graph index'],
  'semantic_search': ['semantic search', 'vector search', 'hybrid search'],
  'private_memory': ['private memory', 'personal memory', 'agent memory'],
  'safe_sql': ['safe sql', 'read-only sql', 'database question']
};

export class EntityLinkingService {
  constructor(private readonly database?: Database) {}

  link(text: string): EntityLinkingResult {
    const entities: LinkedEntity[] = [];
    this.extractAliasEntities(text, SOFTWARE_ALIASES, 'software', entities);
    this.extractAliasEntities(text, CONCEPT_ALIASES, 'concept', entities);
    this.extractDates(text, entities);
    this.extractTickers(text, entities);
    this.extractProperNouns(text, entities);

    const deduped = this.dedupe(entities);
    return {
      text,
      entities: deduped,
      facets: {
        years: deduped.filter(entity => entity.type === 'date')
          .map(entity => Number(entity.normalized))
          .filter(Number.isFinite),
        software: deduped.filter(entity => entity.type === 'software').map(entity => entity.normalized),
        people: deduped.filter(entity => entity.type === 'person').map(entity => entity.label),
        concepts: deduped.filter(entity => entity.type === 'concept').map(entity => entity.normalized)
      }
    };
  }

  async linkAndPersist(text: string): Promise<EntityLinkingResult> {
    const result = this.link(text);
    if (!this.database) {
      return result;
    }

    for (const entity of result.entities) {
      const params = [
        entity.id,
        entity.label,
        entity.normalized,
        entity.type,
        JSON.stringify(entity.aliases),
        entity.confidence,
        entity.source
      ];
      if (this.database.getType() === 'postgresql') {
        await this.database.query(
          `INSERT INTO linked_entities (id, label, normalized, entity_type, aliases, confidence, source, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO UPDATE SET
             label = EXCLUDED.label,
             normalized = EXCLUDED.normalized,
             entity_type = EXCLUDED.entity_type,
             aliases = EXCLUDED.aliases,
             confidence = EXCLUDED.confidence,
             source = EXCLUDED.source,
             updated_at = CURRENT_TIMESTAMP`,
          params
        );
      } else {
        await this.database.query(
          `INSERT OR REPLACE INTO linked_entities (id, label, normalized, entity_type, aliases, confidence, source, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          params
        );
      }
    }

    return result;
  }

  async searchEntities(query: string, limit: number = 20): Promise<LinkedEntity[]> {
    if (!this.database) {
      return this.link(query).entities;
    }
    const like = `%${query.replace(/[%_]/g, '')}%`;
    const result = this.database.getType() === 'postgresql'
      ? await this.database.query(
          `SELECT * FROM linked_entities
           WHERE label ILIKE $1 OR normalized ILIKE $1
           ORDER BY confidence DESC, updated_at DESC
           LIMIT $2`,
          [like, limit]
        )
      : await this.database.query(
          `SELECT * FROM linked_entities
           WHERE label LIKE ? OR normalized LIKE ?
           ORDER BY confidence DESC, updated_at DESC
           LIMIT ?`,
          [like, like, limit]
        );
    return result.rows.map(row => ({
      id: row.id,
      label: row.label,
      normalized: row.normalized,
      type: row.entity_type,
      aliases: typeof row.aliases === 'string' ? JSON.parse(row.aliases || '[]') : row.aliases || [],
      confidence: Number(row.confidence || 0),
      startIndex: 0,
      endIndex: row.label.length,
      source: row.source || 'regex'
    }));
  }

  async stats(): Promise<{ total: number; byType: Record<string, number> }> {
    if (!this.database) {
      return { total: 0, byType: {} };
    }
    const result = await this.database.query('SELECT entity_type, COUNT(*) AS count FROM linked_entities GROUP BY entity_type');
    const byType: Record<string, number> = {};
    let total = 0;
    for (const row of result.rows) {
      const count = Number(row.count || 0);
      byType[row.entity_type] = count;
      total += count;
    }
    return { total, byType };
  }


  private extractAliasEntities(
    text: string,
    aliases: Record<string, string[]>,
    type: LinkedEntityType,
    entities: LinkedEntity[]
  ): void {
    const lower = text.toLowerCase();
    for (const [normalized, variants] of Object.entries(aliases)) {
      for (const phrase of variants) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(lower)) !== null) {
          entities.push(this.entity(match[0], normalized, type, match.index, match.index + match[0].length, 'alias', variants, 0.94));
        }
      }
    }
  }

  private extractDates(text: string, entities: LinkedEntity[]): void {
    const dateRegex = /\b(\d{1,5})\s*(bc|bce|ce|ad)?\b/gi;
    let match: RegExpExecArray | null;
    while ((match = dateRegex.exec(text)) !== null) {
      const rawYear = Number(match[1]);
      if (!Number.isFinite(rawYear)) continue;
      const era = (match[2] || '').toLowerCase();
      if (rawYear < 100 && !era) continue;
      const normalized = era === 'bc' || era === 'bce' ? String(-rawYear) : String(rawYear);
      entities.push(this.entity(match[0], normalized, 'date', match.index, match.index + match[0].length, 'regex', [], era ? 0.96 : 0.76));
    }
  }

  private extractTickers(text: string, entities: LinkedEntity[]): void {
    const tickerRegex = /\$([A-Z]{1,5})\b|\b([A-Z]{2,5})\b(?=\s+(?:stock|shares|calls|puts|earnings))/g;
    let match: RegExpExecArray | null;
    while ((match = tickerRegex.exec(text)) !== null) {
      const label = match[1] || match[2];
      entities.push(this.entity(label, label.toUpperCase(), 'ticker', match.index, match.index + match[0].length, 'regex', [], 0.82));
    }
  }

  private extractProperNouns(text: string, entities: LinkedEntity[]): void {
    const properNounRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
    let match: RegExpExecArray | null;
    while ((match = properNounRegex.exec(text)) !== null) {
      const label = match[1];
      if (/^(United States|New York|Los Angeles|San Francisco)$/.test(label)) {
        entities.push(this.entity(label, this.slug(label), 'place', match.index, match.index + label.length, 'regex', [], 0.72));
      } else {
        entities.push(this.entity(label, this.slug(label), 'person', match.index, match.index + label.length, 'regex', [], 0.64));
      }
    }
  }

  private dedupe(entities: LinkedEntity[]): LinkedEntity[] {
    const bySpanAndType = new Map<string, LinkedEntity>();
    for (const entity of entities.sort((a, b) => b.confidence - a.confidence)) {
      const key = `${entity.type}:${entity.startIndex}:${entity.endIndex}:${entity.normalized}`;
      if (!bySpanAndType.has(key)) {
        bySpanAndType.set(key, entity);
      }
    }
    return Array.from(bySpanAndType.values()).sort((a, b) => a.startIndex - b.startIndex);
  }

  private entity(
    label: string,
    normalized: string,
    type: LinkedEntityType,
    startIndex: number,
    endIndex: number,
    source: LinkedEntity['source'],
    aliases: string[] = [],
    confidence: number
  ): LinkedEntity {
    return {
      id: `${type}_${createHash('sha1').update(`${type}:${normalized}`).digest('hex').slice(0, 12)}`,
      label,
      normalized,
      type,
      aliases,
      confidence,
      startIndex,
      endIndex,
      source
    };
  }

  private slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
}
