import { CreativeCapabilityDetector } from '../src/core/creative/CreativeCapabilityDetector';
import { CreativeProjectStore } from '../src/core/creative/CreativeProjectStore';
import { CreativeWritingAgent } from '../src/core/creative/CreativeWritingAgent';
import { PromptPackLibrary } from '../src/core/creative/PromptPackLibrary';
import { RoleplaySessionEngine } from '../src/core/creative/RoleplaySessionEngine';
import { StoryBibleStore } from '../src/core/creative/StoryBibleStore';

describe('E2E Creative Release Scenario', () => {
  it('creates a project, drafts, roleplays, revises, maintains continuity, and exports', async () => {
    const bibles = new StoryBibleStore();
    const projects = new CreativeProjectStore();
    const roleplay = new RoleplaySessionEngine();
    const packs = new PromptPackLibrary();
    const agent = new CreativeWritingAgent();

    const bible = bibles.create({
      title: 'Northglass',
      characters: [{ id: 'mara', name: 'Mara Venn', role: 'lighthouse keeper', pinned: true }],
      locations: [{ id: 'tower', name: 'Northglass Lighthouse', description: 'icebound tower', pinned: true }],
      continuityNotes: [{ id: 'signal', text: 'The signal repeats every thirteen minutes.', pinned: true }],
    });
    const project = projects.createProject({ title: 'Signal Under Ice', genre: 'dark_horror', rating: 'Teen' });
    const chapter = projects.addChapter(project.id, { title: 'The Thirteenth Minute' });
    const scene = projects.addScene(project.id, chapter.id, { title: 'Signal Room' });
    const pack = packs.create({
      name: 'Dread Builder',
      category: 'scene_type',
      prompts: [{ id: 'dread', title: 'Dread', text: 'Escalate by implication before revelation.' }],
    });

    const draft = await agent.draftScene({
      prompt: packs.apply(pack.id, 'dread', 'Draft the opening signal room scene.'),
      genre: 'dark_horror',
      rating: 'Teen',
      storyBible: bibles.buildContext(bible.id),
      project: { title: project.title, workflowStage: 'draft_chapter', currentChapter: chapter.title, currentScene: scene.title },
    });
    const draftVersion = projects.addDraftVersion(project.id, scene.id, { content: draft.response });
    const branch = projects.createBranch(project.id, scene.id, { name: 'door opens', parentVersionId: draftVersion.id });
    const alternate = await agent.continueScene({
      prompt: 'Continue with Mara opening the basement door.',
      genre: 'dark_horror',
      rating: 'Teen',
      storyBible: bibles.buildContext(bible.id),
      branch: { branchId: branch.id, alternateTakes: ['Mara opens the door.'] },
    });
    projects.addDraftVersion(project.id, scene.id, { content: alternate.response, branchId: branch.id });
    projects.restoreBranch(project.id, scene.id, branch.id);

    const session = roleplay.start({
      playerCharacter: 'Mara',
      assistantCharacter: 'Signal Voice',
      sceneLocation: 'Northglass Lighthouse',
      activeCast: ['Mara', 'Signal Voice'],
      goals: ['identify the signal'],
    });
    const turn = await agent.roleplayTurn({
      prompt: 'Mara asks the signal voice who is below the ice.',
      genre: 'dark_horror',
      rating: 'Teen',
      roleplay: session,
    });
    roleplay.recordTurn(session.id, { speaker: 'Signal Voice', text: turn.response });

    const revision = await agent.revisePassage({
      prompt: turn.response,
      genre: 'dark_horror',
      rating: 'Teen',
      revisionOperation: 'increase_tension',
      storyBible: bibles.buildContext(bible.id),
    });
    const exported = projects.exportProject(project.id, 'markdown');
    const degraded = new CreativeCapabilityDetector().evaluate([
      { provider: 'template', model: 'template', maxTokens: 1000, qualityScore: 0.3 },
    ]);

    expect(draft.response).toContain('Mara Venn');
    expect(alternate.response).toContain('Branching:');
    expect(turn.response).toContain('Northglass Lighthouse');
    expect(revision.response).toContain('increase_tension');
    expect(exported.content).toContain('# Signal Under Ice');
    expect(degraded.degraded).toBe(true);
  });
});
