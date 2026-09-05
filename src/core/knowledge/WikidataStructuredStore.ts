/**
 * Wikidata Structured Store (CRK Phase 19: CRK-P19-T02)
 *
 * Ingests structured Wikidata entities and relationships into KnowledgeGraph
 * without bloating into redundant vector prose.
 */

import { WikidataEntity, WikidataClaim } from '../../types/general-knowledge';
import { KnowledgeGraph, Entity as GraphEntity, Relationship as GraphRelationship } from './KnowledgeGraph';

export class WikidataStructuredStore {
  private entities: Map<string, WikidataEntity> = new Map();
  private labelToEntityId: Map<string, Set<string>> = new Map();
  private aliasToEntityId: Map<string, Set<string>> = new Map();
  private knowledgeGraph: KnowledgeGraph;

  constructor(knowledgeGraph?: KnowledgeGraph) {
    this.knowledgeGraph = knowledgeGraph || new KnowledgeGraph();
  }

  /**
   * Ingest a structured Wikidata entity record (§3095-3105)
   */
  public ingestEntity(entity: WikidataEntity): void {
    this.entities.set(entity.entityId, entity);

    // Index by label
    const lowerLabel = entity.label.toLowerCase();
    if (!this.labelToEntityId.has(lowerLabel)) {
      this.labelToEntityId.set(lowerLabel, new Set());
    }
    this.labelToEntityId.get(lowerLabel)!.add(entity.entityId);

    // Index by aliases
    for (const alias of entity.aliases) {
      const lowerAlias = alias.toLowerCase();
      if (!this.aliasToEntityId.has(lowerAlias)) {
        this.aliasToEntityId.set(lowerAlias, new Set());
      }
      this.aliasToEntityId.get(lowerAlias)!.add(entity.entityId);
    }

    // Bridge into existing KnowledgeGraph for graph traversal without text duplication
    const graphEntity: GraphEntity = {
      id: entity.entityId,
      name: entity.label,
      type: 'wikidata_entity',
      properties: {
        description: entity.description,
        aliases: entity.aliases,
        wikipediaUrl: entity.wikipediaUrl,
        claimsCount: entity.claims.length,
        provenance: entity.provenance,
      },
    };
    this.knowledgeGraph.addEntity(graphEntity);

    // Add graph relationships for instanceOf (P31) and subclassOf (P279)
    for (const parentId of entity.instanceOf) {
      const rel: GraphRelationship = {
        id: `rel-${entity.entityId}-P31-${parentId}`,
        source: entity.entityId,
        target: parentId,
        type: 'instance_of',
        properties: { propertyId: 'P31' },
        confidence: 1.0,
      };
      this.knowledgeGraph.addRelationship(rel);
    }

    for (const parentId of entity.subclassOf) {
      const rel: GraphRelationship = {
        id: `rel-${entity.entityId}-P279-${parentId}`,
        source: entity.entityId,
        target: parentId,
        type: 'subclass_of',
        properties: { propertyId: 'P279' },
        confidence: 1.0,
      };
      this.knowledgeGraph.addRelationship(rel);
    }
  }

  public getEntity(entityId: string): WikidataEntity | undefined {
    return this.entities.get(entityId);
  }

  public findByLabelOrAlias(query: string): WikidataEntity[] {
    const lower = query.toLowerCase().trim();
    const resultIds = new Set<string>();

    const direct = this.labelToEntityId.get(lower);
    if (direct) {
      for (const id of direct) resultIds.add(id);
    }

    const aliasMatches = this.aliasToEntityId.get(lower);
    if (aliasMatches) {
      for (const id of aliasMatches) resultIds.add(id);
    }

    return Array.from(resultIds)
      .map((id) => this.entities.get(id)!)
      .filter(Boolean);
  }

  public getClaims(entityId: string, propertyId?: string): WikidataClaim[] {
    const entity = this.entities.get(entityId);
    if (!entity) return [];
    if (!propertyId) return entity.claims;
    return entity.claims.filter((c) => c.propertyId === propertyId);
  }

  public getEntityCount(): number {
    return this.entities.size;
  }

  public getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }
}
