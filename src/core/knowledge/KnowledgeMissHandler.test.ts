import { KnowledgeMissHandler } from './KnowledgeMissHandler';

describe('KnowledgeMissHandler', () => {
  it('creates a structured online-search prompt for local misses', () => {
    const handler = new KnowledgeMissHandler();
    const miss = handler.createMiss('What changed in the newest Godot release?', 'gaming');

    expect(miss.knowledgeMiss).toBe(true);
    expect(miss.type).toBe('knowledge_miss');
    expect(miss.canSearchOnline).toBe(true);
    expect(miss.proposedWebQuery).toContain('What changed');
    expect(miss.suggestedNextAction).toBe('search_online');
  });
});
