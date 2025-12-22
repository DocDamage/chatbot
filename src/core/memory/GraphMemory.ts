/**
 * Graph Memory
 * Graph-based persistent memory system inspired by Zep/Graphiti
 * Stores entities, relationships, and temporal context
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface Entity {
    id: string;
    type: EntityType;
    name: string;
    properties: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
    decayScore: number;
}

export interface Relationship {
    id: string;
    sourceId: string;
    targetId: string;
    type: string;
    properties: Record<string, any>;
    weight: number;
    createdAt: Date;
}

export type EntityType =
    | 'person'
    | 'topic'
    | 'concept'
    | 'project'
    | 'file'
    | 'code'
    | 'preference'
    | 'fact'
    | 'event'
    | 'location';

export interface MemoryQuery {
    entityTypes?: EntityType[];
    relationshipTypes?: string[];
    minDecayScore?: number;
    limit?: number;
    since?: Date;
}

export interface MemoryContext {
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
}

export interface GraphMemoryConfig {
    persistPath?: string;
    decayRate: number;
    maxEntities: number;
    autoSave: boolean;
    autoSaveInterval: number;
}

export class GraphMemory {
    private entities: Map<string, Entity> = new Map();
    private relationships: Map<string, Relationship> = new Map();
    private entityIndex: Map<string, Set<string>> = new Map(); // type -> entity ids
    private config: GraphMemoryConfig;
    private persistPath: string;
    private saveTimer?: NodeJS.Timer;

    constructor(config?: Partial<GraphMemoryConfig>) {
        this.config = {
            persistPath: 'data/graph_memory.json',
            decayRate: 0.01,
            maxEntities: 10000,
            autoSave: true,
            autoSaveInterval: 60000, // 1 minute
            ...config
        };

        this.persistPath = path.resolve(process.cwd(), this.config.persistPath || 'data/graph_memory.json');
    }

    /**
     * Initialize and load persisted data
     */
    async initialize(): Promise<void> {
        await this.load();

        if (this.config.autoSave) {
            this.saveTimer = setInterval(() => this.save(), this.config.autoSaveInterval);
        }

        logger.info('Graph memory initialized', {
            entities: this.entities.size,
            relationships: this.relationships.size
        });
    }

    /**
     * Shutdown and save
     */
    async shutdown(): Promise<void> {
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
        }
        await this.save();
    }

    /**
     * Add or update an entity
     */
    addEntity(
        type: EntityType,
        name: string,
        properties: Record<string, any> = {}
    ): Entity {
        // Check if entity already exists by name and type
        const existingId = this.findEntityByName(name, type);

        if (existingId) {
            return this.updateEntity(existingId, properties);
        }

        const entity: Entity = {
            id: this.generateId(),
            type,
            name,
            properties,
            createdAt: new Date(),
            updatedAt: new Date(),
            accessCount: 1,
            decayScore: 1.0
        };

        this.entities.set(entity.id, entity);
        this.indexEntity(entity);

        // Enforce max entities
        if (this.entities.size > this.config.maxEntities) {
            this.pruneOldEntities();
        }

        logger.debug('Entity added', { id: entity.id, type, name });
        return entity;
    }

    /**
     * Update existing entity
     */
    updateEntity(entityId: string, properties: Record<string, any>): Entity {
        const entity = this.entities.get(entityId);
        if (!entity) {
            throw new Error(`Entity not found: ${entityId}`);
        }

        entity.properties = { ...entity.properties, ...properties };
        entity.updatedAt = new Date();
        entity.accessCount++;
        entity.decayScore = 1.0; // Reset decay on update

        return entity;
    }

    /**
     * Add a relationship between entities
     */
    addRelationship(
        sourceId: string,
        targetId: string,
        type: string,
        properties: Record<string, any> = {},
        weight: number = 1.0
    ): Relationship {
        if (!this.entities.has(sourceId)) {
            throw new Error(`Source entity not found: ${sourceId}`);
        }
        if (!this.entities.has(targetId)) {
            throw new Error(`Target entity not found: ${targetId}`);
        }

        // Check for existing relationship
        const existing = this.findRelationship(sourceId, targetId, type);
        if (existing) {
            existing.weight = Math.min(existing.weight + 0.1, 2.0);
            existing.properties = { ...existing.properties, ...properties };
            return existing;
        }

        const relationship: Relationship = {
            id: this.generateId(),
            sourceId,
            targetId,
            type,
            properties,
            weight,
            createdAt: new Date()
        };

        this.relationships.set(relationship.id, relationship);

        logger.debug('Relationship added', {
            source: sourceId,
            target: targetId,
            type
        });

        return relationship;
    }

    /**
     * Get entity by ID
     */
    getEntity(id: string): Entity | undefined {
        const entity = this.entities.get(id);
        if (entity) {
            entity.accessCount++;
            entity.decayScore = Math.min(entity.decayScore + 0.1, 1.0);
        }
        return entity;
    }

    /**
     * Find entity by name and type
     */
    findEntityByName(name: string, type?: EntityType): string | undefined {
        const lowerName = name.toLowerCase();

        for (const [id, entity] of this.entities) {
            if (entity.name.toLowerCase() === lowerName) {
                if (!type || entity.type === type) {
                    return id;
                }
            }
        }
        return undefined;
    }

    /**
     * Search entities by text
     */
    searchEntities(query: string, options: MemoryQuery = {}): Entity[] {
        const lowerQuery = query.toLowerCase();
        const results: Entity[] = [];

        for (const entity of this.entities.values()) {
            // Apply filters
            if (options.entityTypes && !options.entityTypes.includes(entity.type)) {
                continue;
            }
            if (options.minDecayScore && entity.decayScore < options.minDecayScore) {
                continue;
            }
            if (options.since && entity.updatedAt < options.since) {
                continue;
            }

            // Check name match
            if (entity.name.toLowerCase().includes(lowerQuery)) {
                results.push(entity);
                continue;
            }

            // Check property values
            for (const value of Object.values(entity.properties)) {
                if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
                    results.push(entity);
                    break;
                }
            }
        }

        // Sort by decay score and access count
        results.sort((a, b) => {
            const scoreA = a.decayScore * Math.log(a.accessCount + 1);
            const scoreB = b.decayScore * Math.log(b.accessCount + 1);
            return scoreB - scoreA;
        });

        return results.slice(0, options.limit || 10);
    }

    /**
     * Get related entities
     */
    getRelatedEntities(
        entityId: string,
        relationshipType?: string,
        depth: number = 1
    ): Entity[] {
        const visited = new Set<string>([entityId]);
        const results: Entity[] = [];

        const traverse = (currentId: string, currentDepth: number): void => {
            if (currentDepth > depth) return;

            for (const rel of this.relationships.values()) {
                let relatedId: string | null = null;

                if (rel.sourceId === currentId) {
                    relatedId = rel.targetId;
                } else if (rel.targetId === currentId) {
                    relatedId = rel.sourceId;
                }

                if (!relatedId || visited.has(relatedId)) continue;
                if (relationshipType && rel.type !== relationshipType) continue;

                visited.add(relatedId);
                const entity = this.entities.get(relatedId);
                if (entity) {
                    results.push(entity);
                    traverse(relatedId, currentDepth + 1);
                }
            }
        };

        traverse(entityId, 1);
        return results;
    }

    /**
     * Get memory context for a query
     */
    async getContext(query: string, options: MemoryQuery = {}): Promise<MemoryContext> {
        // Search for relevant entities
        const entities = this.searchEntities(query, options);

        // Get relationships between found entities
        const entityIds = new Set(entities.map(e => e.id));
        const relationships: Relationship[] = [];

        for (const rel of this.relationships.values()) {
            if (entityIds.has(rel.sourceId) && entityIds.has(rel.targetId)) {
                relationships.push(rel);
            }
        }

        // Build summary
        const summary = this.buildContextSummary(entities, relationships);

        return { entities, relationships, summary };
    }

    /**
     * Extract and store entities from text
     */
    async extractFromText(text: string, context?: string): Promise<Entity[]> {
        const extracted: Entity[] = [];

        // Simple entity extraction patterns
        const patterns: { regex: RegExp; type: EntityType }[] = [
            { regex: /(?:I am|I'm|My name is|Call me)\s+(\w+)/gi, type: 'person' },
            { regex: /(?:I prefer|I like|I want)\s+(.+?)(?:\.|$)/gi, type: 'preference' },
            { regex: /(?:project|working on|building)\s+["']?(\w+)["']?/gi, type: 'project' },
            { regex: /(?:file|in)\s+["']?([a-zA-Z0-9_\-\.\/]+\.[a-z]+)["']?/gi, type: 'file' }
        ];

        for (const { regex, type } of patterns) {
            let match;
            while ((match = regex.exec(text)) !== null) {
                const name = match[1].trim();
                if (name.length > 2 && name.length < 100) {
                    const entity = this.addEntity(type, name, { source: context });
                    extracted.push(entity);
                }
            }
        }

        return extracted;
    }

    /**
     * Apply decay to all entities
     */
    applyDecay(): void {
        const now = Date.now();

        for (const entity of this.entities.values()) {
            const age = now - entity.updatedAt.getTime();
            const hoursSinceUpdate = age / (1000 * 60 * 60);

            entity.decayScore *= Math.exp(-this.config.decayRate * hoursSinceUpdate);
            entity.decayScore = Math.max(entity.decayScore, 0.01);
        }

        logger.debug('Decay applied to entities');
    }

    /**
     * Prune old/unused entities
     */
    private pruneOldEntities(): void {
        const entities = Array.from(this.entities.values())
            .sort((a, b) => a.decayScore - b.decayScore);

        const toRemove = entities.slice(0, Math.floor(entities.length * 0.1));

        for (const entity of toRemove) {
            this.removeEntity(entity.id);
        }

        logger.info('Pruned entities', { removed: toRemove.length });
    }

    /**
     * Remove an entity and its relationships
     */
    removeEntity(entityId: string): boolean {
        const entity = this.entities.get(entityId);
        if (!entity) return false;

        // Remove from index
        const typeIndex = this.entityIndex.get(entity.type);
        if (typeIndex) {
            typeIndex.delete(entityId);
        }

        // Remove relationships
        for (const [relId, rel] of this.relationships) {
            if (rel.sourceId === entityId || rel.targetId === entityId) {
                this.relationships.delete(relId);
            }
        }

        this.entities.delete(entityId);
        return true;
    }

    /**
     * Find existing relationship
     */
    private findRelationship(
        sourceId: string,
        targetId: string,
        type: string
    ): Relationship | undefined {
        for (const rel of this.relationships.values()) {
            if (rel.sourceId === sourceId &&
                rel.targetId === targetId &&
                rel.type === type) {
                return rel;
            }
        }
        return undefined;
    }

    /**
     * Index entity by type
     */
    private indexEntity(entity: Entity): void {
        let typeIndex = this.entityIndex.get(entity.type);
        if (!typeIndex) {
            typeIndex = new Set();
            this.entityIndex.set(entity.type, typeIndex);
        }
        typeIndex.add(entity.id);
    }

    /**
     * Build context summary
     */
    private buildContextSummary(
        entities: Entity[],
        relationships: Relationship[]
    ): string {
        if (entities.length === 0) {
            return 'No relevant memories found.';
        }

        const parts: string[] = [];

        // Group entities by type
        const byType = new Map<EntityType, Entity[]>();
        for (const entity of entities) {
            const list = byType.get(entity.type) || [];
            list.push(entity);
            byType.set(entity.type, list);
        }

        for (const [type, list] of byType) {
            const names = list.slice(0, 5).map(e => e.name).join(', ');
            parts.push(`${type}s: ${names}`);
        }

        if (relationships.length > 0) {
            parts.push(`Connections: ${relationships.length} relationships`);
        }

        return parts.join('. ');
    }

    /**
     * Save to disk
     */
    async save(): Promise<void> {
        const data = {
            entities: Array.from(this.entities.values()),
            relationships: Array.from(this.relationships.values()),
            savedAt: new Date().toISOString()
        };

        const dir = path.dirname(this.persistPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
        logger.debug('Graph memory saved', { path: this.persistPath });
    }

    /**
     * Load from disk
     */
    private async load(): Promise<void> {
        if (!fs.existsSync(this.persistPath)) {
            return;
        }

        try {
            const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));

            for (const entity of data.entities || []) {
                entity.createdAt = new Date(entity.createdAt);
                entity.updatedAt = new Date(entity.updatedAt);
                this.entities.set(entity.id, entity);
                this.indexEntity(entity);
            }

            for (const rel of data.relationships || []) {
                rel.createdAt = new Date(rel.createdAt);
                this.relationships.set(rel.id, rel);
            }

            logger.info('Graph memory loaded', {
                entities: this.entities.size,
                relationships: this.relationships.size
            });

        } catch (error: any) {
            logger.warn('Failed to load graph memory', { error: error.message });
        }
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    getStats(): {
        entityCount: number;
        relationshipCount: number;
        typeDistribution: Record<string, number>;
        avgDecayScore: number;
    } {
        const typeDistribution: Record<string, number> = {};
        let totalDecay = 0;

        for (const entity of this.entities.values()) {
            typeDistribution[entity.type] = (typeDistribution[entity.type] || 0) + 1;
            totalDecay += entity.decayScore;
        }

        return {
            entityCount: this.entities.size,
            relationshipCount: this.relationships.size,
            typeDistribution,
            avgDecayScore: this.entities.size > 0 ? totalDecay / this.entities.size : 0
        };
    }
}
