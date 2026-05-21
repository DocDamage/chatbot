import { buildChatContextBundle, renderChatContext } from './chat';

describe('chat context DTO', () => {
  it('bundles system instructions, active plans, loaded files, and audio context', () => {
    const bundle = buildChatContextBundle({
      message: 'Implement the saved plan',
      sessionId: 'session-1',
      systemPrompt: 'Prefer small, verifiable changes.',
      activePlanId: 'plan-123',
      activePlanContent: '# Plan\n- Wire context into the agent.',
      loadedFiles: [
        {
          path: 'src/index.ts',
          content: 'console.log("hello");',
        },
      ],
      loadedAudio: [
        {
          path: 'audio/take.wav',
          duration: 12,
        },
      ],
    });

    expect(bundle.systemInstruction).toBe('Prefer small, verifiable changes.');
    expect(bundle.plan?.id).toBe('plan-123');
    expect(bundle.files).toEqual([
      {
        path: 'src/index.ts',
        content: 'console.log("hello");',
      },
    ]);
    expect(bundle.audio).toHaveLength(1);

    const rendered = renderChatContext(bundle);
    expect(rendered).toContain('System instruction:');
    expect(rendered).toContain('Active implementation plan (plan-123):');
    expect(rendered).toContain('--- src/index.ts ---');
    expect(rendered).toContain('audio/take.wav (12s)');
  });
});
