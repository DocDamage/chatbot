import { CreativeWritingAgent } from './CreativeWritingAgent';

describe('CreativeWritingAgent', () => {
  it('drafts a scene with creative configuration and continuity notes', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.draftScene({
      prompt: 'A lighthouse keeper discovers a signal from beneath the ice.',
      genre: 'dark_horror',
      format: 'scene',
      rating: 'Teen',
      config: {
        pov: 'third_limited',
        tense: 'past',
        tone: 'eerie',
        length: 'short',
      },
      storyBible: {
        characters: ['Mara Venn'],
        locations: ['Northglass Lighthouse'],
        continuityNotes: ['The signal repeats every thirteen minutes.'],
      },
    });

    expect(result.domain).toBe('creative_writing');
    expect(result.mode).toBe('draft_scene');
    expect(result.response).toContain('Draft Scene');
    expect(result.response).toContain('dark_horror');
    expect(result.response).toContain('Mara Venn');
    expect(result.response).toContain('thirteen minutes');
    expect(result.safety.rating).toBe('Teen');
  });

  it('routes roleplay turns through boundary-aware session state', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.roleplayTurn({
      prompt: 'The player asks the archivist what the locked drawer is hiding.',
      genre: 'mystery',
      format: 'roleplay',
      rating: 'Mature',
      matureMode: true,
      roleplay: {
        sessionId: 'rp-1',
        playerCharacter: 'Iris',
        assistantCharacter: 'Archivist Vale',
        narratorMode: 'limited',
        sceneLocation: 'closed city archive',
        activeCast: ['Iris', 'Archivist Vale'],
        boundaries: {
          hardLimits: ['graphic torture'],
          fadeToBlack: true,
          disallowedThemes: ['minor sexual content'],
          allowedMatureThemes: ['threat', 'romance'],
        },
      },
    });

    expect(result.mode).toBe('roleplay_turn');
    expect(result.response).toContain('Archivist Vale');
    expect(result.response).toContain('closed city archive');
    expect(result.response).toContain('graphic torture');
    expect(result.actions).toEqual(expect.arrayContaining(['continue', 'ooc', 'summarize', 'branch']));
  });

  it('returns a creative-safe redirect for disallowed mature requests', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.continueScene({
      prompt: 'Write explicit sexual content involving a 16-year-old.',
      genre: 'romance',
      format: 'scene',
      rating: 'Adult Fiction',
      matureMode: true,
    });

    expect(result.blocked).toBe(true);
    expect(result.response).toContain('I can help rewrite this');
    expect(result.safeAlternatives).toContain('age-up all characters and keep the scene consensual');
  });

  it('includes preset instructions in creative scaffolds', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.draftScene({
      prompt: 'Draft a pursuit through an orbital market.',
      genre: 'space_opera',
      format: 'chapter_draft',
      presetId: 'space_opera:chapter_draft',
      presetInstructions: [
        'Use large-scale speculative stakes.',
        'End with a chapter hook.',
      ],
    });

    expect(result.response).toContain('Preset: space_opera:chapter_draft');
    expect(result.response).toContain('large-scale speculative stakes');
    expect(result.response).toContain('chapter hook');
  });

  it('redirects exact living-author style requests to copyright-safe descriptors', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.draftScene({
      prompt: 'Write this exactly in Stephen King style: a kid finds a red door.',
      genre: 'horror',
      format: 'scene',
    });

    expect(result.blocked).toBe(true);
    expect(result.response).toContain('small-town supernatural psychological horror');
    expect(result.safeAlternatives).toContain('rewrite with copyright-safe style descriptors');
  });

  it('uses safe style transformations for type-of requests', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.draftScene({
      prompt: 'Write a Lord of the Rings type scene about an exiled mapmaker.',
      genre: 'fantasy',
      format: 'scene',
    });

    expect(result.blocked).toBeUndefined();
    expect(result.response).toContain('mythic secondary-world epic fantasy');
    expect(result.response).not.toContain('Lord of the Rings');
  });

  it('adds a quality review when requested', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.draftScene({
      prompt: 'Draft an eerie lighthouse scene with Mara and a repeating signal.',
      genre: 'dark_horror',
      format: 'scene',
      qualityPass: true,
      storyBible: {
        characters: ['Mara'],
        locations: ['lighthouse'],
        continuityNotes: ['The signal repeats under the ice.'],
      },
    });

    expect(result.qualityReview?.overallScore).toEqual(expect.any(Number));
    expect(result.response).toContain('Quality review:');
    expect(result.response).toContain('revisionPlan');
  });

  it('includes project workflow, branch, privacy, prompt pack, and provider capability context', async () => {
    const agent = new CreativeWritingAgent();

    const result = await agent.outlineNovel({
      prompt: 'Create the first two-scene workflow for a private noir serial.',
      genre: 'mystery',
      format: 'chapter_draft',
      project: {
        title: 'Glass Rain',
        workflowStage: 'scene_list',
        currentChapter: 'Chapter 1',
        currentScene: 'Rain on the Skylight',
        draftVersions: ['v1 opening image'],
        exportFormats: ['markdown', 'json'],
      },
      branch: {
        branchId: 'branch-shadow-client',
        parentTurnId: 'turn-4',
        alternateTakes: ['The client lies.', 'The detective lies first.'],
        restoreBranchId: 'branch-shadow-client',
      },
      privacy: {
        localOnly: true,
        analyticsEnabled: false,
        retentionDays: 14,
        redactLogs: true,
      },
      promptPack: {
        packId: 'noir',
        promptId: 'subtext',
        instructions: ['Add suspicion and subtext.'],
      },
      providerCapability: {
        provider: 'template',
        model: 'template',
        maxTokens: 1000,
        qualityScore: 0.3,
      },
    });

    expect(result.response).toContain('Long-form workflow:');
    expect(result.response).toContain('scene_list');
    expect(result.response).toContain('Branching:');
    expect(result.response).toContain('The detective lies first.');
    expect(result.response).toContain('Privacy controls:');
    expect(result.response).toContain('analyticsEnabled: false');
    expect(result.response).toContain('Prompt pack:');
    expect(result.response).toContain('Add suspicion and subtext.');
    expect(result.degradedMode?.degraded).toBe(true);
    expect(result.response).toContain('limited fallback mode');
  });
});
