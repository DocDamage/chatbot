import { describe, expect, it } from 'vitest';
import { resolveKnowledgeMissState } from './AssistantChat';

describe('AssistantChat knowledge miss state', () => {
  it('uses the typed knowledgeMissDetail response field', () => {
    const state = resolveKnowledgeMissState({
      knowledgeMissDetail: {
        knowledgeMiss: true,
        type: 'knowledge_miss',
        message: 'What changed in Godot 4.5?',
        domain: 'gaming',
        proposedWebQuery: 'Godot 4.5 release notes',
        recommendedSources: ['official game or engine documentation'],
        canSearchOnline: true,
        suggestedNextAction: 'search_online',
      },
    }, 'What changed?', 'ask');

    expect(state).toEqual({
      query: 'Godot 4.5 release notes',
      domain: 'gaming',
      recommendedSources: ['official game or engine documentation'],
    });
  });

  it('clears the CTA state when a response is not a knowledge miss', () => {
    expect(resolveKnowledgeMissState({ response: 'Known answer' }, 'question', 'ask')).toBeNull();
  });
});
