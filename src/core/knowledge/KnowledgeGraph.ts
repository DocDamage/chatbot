/**
 * Knowledge Graph - Entity relationship tracking and reasoning
 */

import { logger } from '../observability/logger';

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
  embeddings?: number[];
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  confidence: number;
}

export interface GraphQuery {
  entityId?: string;
  entityName?: string;
  relationshipType?: string;
  limit?: number;
}

export class KnowledgeGraph {
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map(); // name -> entity IDs
  private relationshipIndex: Map<string, Set<string>> = new Map(); // source -> relationship IDs

  /**
   * Add entity to graph
   */
  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    
    // Index by name
    const nameKey = entity.name.toLowerCase();
    if (!this.entityIndex.has(nameKey)) {
      this.entityIndex.set(nameKey, new Set());
    }
    this.entityIndex.get(nameKey)!.add(entity.id);
    
    logger.debug('Entity added to knowledge graph', { id: entity.id, name: entity.name });
  }

  /**
   * Add relationship
   */
  addRelationship(relationship: Relationship): void {
    this.relationships.set(relationship.id, relationship);
    
    // Index by source
    if (!this.relationshipIndex.has(relationship.source)) {
      this.relationshipIndex.set(relationship.source, new Set());
    }
    this.relationshipIndex.get(relationship.source)!.add(relationship.id);
    
    logger.debug('Relationship added to knowledge graph', {
      id: relationship.id,
      type: relationship.type,
      source: relationship.source,
      target: relationship.target,
    });
  }

  /**
   * Query entities
   */
  queryEntities(query: GraphQuery): Entity[] {
    let results: Entity[] = [];

    if (query.entityId) {
      const entity = this.entities.get(query.entityId);
      if (entity) results.push(entity);
    } else if (query.entityName) {
      const nameKey = query.entityName.toLowerCase();
      const entityIds = this.entityIndex.get(nameKey);
      if (entityIds) {
        for (const id of entityIds) {
          const entity = this.entities.get(id);
          if (entity) results.push(entity);
        }
      }
    } else {
      results = Array.from(this.entities.values());
    }

    return results.slice(0, query.limit || 50);
  }

  /**
   * Query relationships
   */
  queryRelationships(query: GraphQuery): Relationship[] {
    let results: Relationship[] = [];

    if (query.entityId) {
      const relationshipIds = this.relationshipIndex.get(query.entityId);
      if (relationshipIds) {
        for (const id of relationshipIds) {
          const rel = this.relationships.get(id);
          if (rel && (!query.relationshipType || rel.type === query.relationshipType)) {
            results.push(rel);
          }
        }
      }
    } else if (query.relationshipType) {
      results = Array.from(this.relationships.values())
        .filter(rel => rel.type === query.relationshipType);
    } else {
      results = Array.from(this.relationships.values());
    }

    return results.slice(0, query.limit || 50);
  }

  /**
   * Find related entities
   */
  findRelatedEntities(entityId: string, maxDepth: number = 2): Entity[] {
    const visited = new Set<string>();
    const related: Entity[] = [];
    
    const traverse = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);

      const relationships = this.queryRelationships({ entityId: id });
      for (const rel of relationships) {
        const targetId = rel.target === id ? rel.source : rel.target;
        const targetEntity = this.entities.get(targetId);
        if (targetEntity && !related.some(e => e.id === targetId)) {
          related.push(targetEntity);
          traverse(targetId, depth + 1);
        }
      }
    };

    traverse(entityId, 0);
    return related;
  }

  /**
   * Extract entities and relationships from text
   */
  async extractFromText(
    text: string,
    llmAdapter: any
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    try {
      const prompt = `Extract entities and relationships from the following text. Return JSON with:
{
  "entities": [{"id": "e1", "name": "Entity Name", "type": "Person|Organization|Concept|Location", "properties": {}}],
  "relationships": [{"id": "r1", "source": "e1", "target": "e2", "type": "relationship_type", "confidence": 0.8}]
}

Text: ${text.substring(0, 2000)}`;

      const response = await llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a knowledge extraction system. Extract entities and relationships in JSON format.',
        maxTokens: 1000,
        temperature: 0.3,
      });

      const parsed = JSON.parse(response.content);
      
      const entities: Entity[] = (parsed.entities || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        properties: e.properties || {},
      }));

      const relationships: Relationship[] = (parsed.relationships || []).map((r: any) => ({
        id: r.id,
        source: r.source,
        target: r.target,
        type: r.type,
        properties: r.properties || {},
        confidence: r.confidence || 0.5,
      }));

      return { entities, relationships };
    } catch (error: any) {
      logger.warn('Failed to extract knowledge from text', { error: error.message });
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    entityCount: number;
    relationshipCount: number;
    entityTypes: Map<string, number>;
    relationshipTypes: Map<string, number>;
  } {
    const entityTypes = new Map<string, number>();
    const relationshipTypes = new Map<string, number>();

    for (const entity of this.entities.values()) {
      entityTypes.set(entity.type, (entityTypes.get(entity.type) || 0) + 1);
    }

    for (const rel of this.relationships.values()) {
      relationshipTypes.set(rel.type, (relationshipTypes.get(rel.type) || 0) + 1);
    }

    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.size,
      entityTypes,
      relationshipTypes,
    };
  }
}

