import { HierarchicalMemory } from '../HierarchicalMemory';
import { MemoryService } from '../MemoryService';

describe('B75-07: HierarchicalMemory Decision Matrix', () => {
  let memoryService: any;
  let hierarchicalMemory: HierarchicalMemory;

  beforeEach(() => {
    memoryService = {
      addEpisodicMemory: jest.fn(),
      getMemoryContext: jest.fn().mockReturnValue({
        episodic_memories: [{ id: 'ep1', content: 'Past conversation' }],
        canonical_facts: [{ id: 'cf1', key: 'user_name', value: 'Alice' }]
      })
    };
    hierarchicalMemory = new HierarchicalMemory(memoryService);
  });

  it('manages working memory additions, prioritization, and expiration cleanup', () => {
    hierarchicalMemory.addWorkingMemory('session_1', 'Important insight', 0.9, 60);
    hierarchicalMemory.addWorkingMemory('session_1', 'Low priority note', 0.3, 60);

    const context = hierarchicalMemory.getContext('session_1');
    expect(context.working.length).toBe(2);
    expect(context.working[0].content).toBe('Important insight');
    expect(context.episodic.length).toBe(1);
    expect(context.canonical.length).toBe(1);
  });

  it('consolidates working memory to episodic memory above threshold', () => {
    hierarchicalMemory.addWorkingMemory('session_2', 'High priority memory', 0.8, 60);
    hierarchicalMemory.addWorkingMemory('session_2', 'Low priority memory', 0.4, 60);

    hierarchicalMemory.consolidate('session_2', 0.7);
    expect(memoryService.addEpisodicMemory).toHaveBeenCalledWith('session_2', expect.objectContaining({
      content: 'High priority memory'
    }));

    const context = hierarchicalMemory.getContext('session_2');
    expect(context.working.length).toBe(1);
    expect(context.working[0].content).toBe('Low priority memory');
  });

  it('tracks and retrieves procedural memories with success rates', () => {
    hierarchicalMemory.addProceduralMemory('error:timeout', 'retry_with_backoff', true);
    hierarchicalMemory.addProceduralMemory('error:timeout', 'retry_with_backoff', true);
    hierarchicalMemory.addProceduralMemory('error:timeout', 'retry_with_backoff', false);

    const proc = hierarchicalMemory.getProceduralMemory('error:timeout in network call');
    expect(proc).toBeDefined();
    expect(proc?.usageCount).toBe(3);
    expect(proc?.successRate).toBeCloseTo(2 / 3);

    const missing = hierarchicalMemory.getProceduralMemory('completely_unknown_pattern');
    expect(missing).toBeNull();
  });
});
