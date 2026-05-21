import { buildChatContextBundle, chatRequestSchema, renderChatContext } from './chat';

describe('chat context DTO', () => {
  it('accepts structured creative writing configuration', () => {
    const result = chatRequestSchema.parse({
      message: 'Draft the next scene.',
      sessionId: 'creative-session',
      mode: 'creative_writing',
      creative: {
        operation: 'draft_scene',
        genre: 'space_opera',
        format: 'chapter_draft',
        rating: 'Mature',
        matureMode: true,
        config: {
          pov: 'third_limited',
          tense: 'past',
          tone: 'tense',
          length: 'medium',
          proseDensity: 7,
          dialogueDensity: 4,
        },
        boundaries: {
          hardLimits: ['real-person sexual content'],
          fadeToBlack: true,
          disallowedThemes: ['minor sexual content'],
          allowedMatureThemes: ['consensual adult romance'],
        },
      },
    });

    expect(result.creative?.operation).toBe('draft_scene');
    expect(result.creative?.rating).toBe('Mature');
  });

  it('rejects impossible creative length and unsafe boundary overrides', () => {
    expect(() => chatRequestSchema.parse({
      message: 'Draft forever.',
      sessionId: 'creative-session',
      mode: 'creative_writing',
      creative: {
        operation: 'draft_scene',
        rating: 'Adult Fiction',
        config: {
          length: 'endless',
        },
        boundaries: {
          disallowedThemes: [],
          unsafeOverride: true,
        },
      },
    })).toThrow();
  });

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
