import { ChronoClaim, ChronoEntity, ChronoEvent, ChronoSource } from './ChronoDate';

export class EntityGraphStore {
  readonly entities = new Map<string, ChronoEntity>();
  readonly events = new Map<string, ChronoEvent>();
  readonly claims = new Map<string, ChronoClaim>();
  readonly sources = new Map<string, ChronoSource>();
  readonly relationships: Array<{ fromId: string; toId: string; type: string; confidence: number }> = [];

  addEntity(entity: ChronoEntity) {
    this.entities.set(entity.id, entity);
  }

  addEvent(event: ChronoEvent) {
    this.events.set(event.id, event);
  }

  addClaim(claim: ChronoClaim) {
    this.claims.set(claim.id, claim);
  }

  addSource(source: ChronoSource) {
    this.sources.set(source.id, source);
  }

  searchEntities(query: string, domain?: string) {
    const lower = query.toLowerCase();
    return Array.from(this.entities.values()).filter(entity =>
      (!domain || entity.domains.includes(domain as any)) &&
      (entity.name.toLowerCase().includes(lower) || entity.aliases.some(alias => alias.toLowerCase().includes(lower)))
    );
  }
}
