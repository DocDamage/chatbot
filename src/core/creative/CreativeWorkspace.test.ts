import { CreativeCapabilityDetector } from './CreativeCapabilityDetector';
import { CreativeProjectStore } from './CreativeProjectStore';
import { CreativePrivacyManager } from './CreativePrivacyManager';
import { PromptPackLibrary } from './PromptPackLibrary';
import { RoleplaySessionEngine } from './RoleplaySessionEngine';
import { StoryBibleStore } from './StoryBibleStore';

describe('creative workspace services', () => {
  it('builds pinned story bible continuity context for later drafts', () => {
    const store = new StoryBibleStore();
    const bible = store.create({
      title: 'Northglass',
      characters: [{ id: 'mara', name: 'Mara Venn', role: 'keeper', pinned: true }],
      locations: [{ id: 'lighthouse', name: 'Northglass Lighthouse', description: 'icebound signal tower', pinned: true }],
      timelineEvents: [{ id: 'signal', summary: 'The signal repeats every thirteen minutes.', order: 1, pinned: true }],
      continuityNotes: [{ id: 'promise', text: 'Mara has not opened the basement door.', pinned: true }],
    });

    const context = store.buildContext(bible.id);

    expect(context.characters).toContain('Mara Venn - keeper');
    expect(context.locations).toContain('Northglass Lighthouse - icebound signal tower');
    expect(context.timelineEvents).toContain('The signal repeats every thirteen minutes.');
    expect(context.continuityNotes).toContain('Mara has not opened the basement door.');
  });

  it('preserves roleplay state across pause, resume, branch, and reset controls', () => {
    const engine = new RoleplaySessionEngine();
    const session = engine.start({
      playerCharacter: 'Iris',
      assistantCharacter: 'Archivist Vale',
      sceneLocation: 'closed city archive',
      activeCast: ['Iris', 'Archivist Vale'],
      goals: ['find the drawer key'],
    });

    engine.recordTurn(session.id, { speaker: 'Iris', text: 'What is in the locked drawer?' });
    engine.pause(session.id);
    const resumed = engine.resume(session.id);
    const branch = engine.branch(session.id, 'ask-about-key');
    engine.reset(session.id);

    expect(resumed.paused).toBe(false);
    expect(resumed.turnHistory).toHaveLength(1);
    expect(branch.parentSessionId).toBe(session.id);
    expect(branch.sceneLocation).toBe('closed city archive');
    expect(engine.get(session.id).turnHistory).toHaveLength(0);
  });

  it('versions creative projects, stores alternate takes, restores branches, and exports metadata', () => {
    const projects = new CreativeProjectStore();
    const project = projects.createProject({ title: 'Signal Under Ice', genre: 'dark_horror', rating: 'Teen' });
    const chapter = projects.addChapter(project.id, { title: 'The Light Below' });
    const scene = projects.addScene(project.id, chapter.id, { title: 'Basement Door', summary: 'Mara hears the signal.' });
    const v1 = projects.addDraftVersion(project.id, scene.id, { content: 'Mara waited at the basement door.' });
    const branch = projects.createBranch(project.id, scene.id, { name: 'Open the door', parentVersionId: v1.id });
    const alt = projects.addDraftVersion(project.id, scene.id, {
      content: 'Mara opened the basement door.',
      branchId: branch.id,
    });

    projects.restoreBranch(project.id, scene.id, branch.id);
    const markdown = projects.exportProject(project.id, 'markdown');
    const json = projects.exportProject(project.id, 'json');

    expect(projects.getProject(project.id).currentBranchId).toBe(branch.id);
    expect(projects.getScene(project.id, scene.id)?.currentVersionId).toBe(alt.id);
    expect(markdown.content).toContain('# Signal Under Ice');
    expect(markdown.content).toContain('Mara opened the basement door.');
    expect(JSON.parse(json.content).chapters[0].scenes[0].versions).toHaveLength(2);
  });

  it('redacts and deletes sensitive creative session data', () => {
    const projects = new CreativeProjectStore();
    const privacy = new CreativePrivacyManager(projects);
    const project = projects.createProject({
      title: 'Private Draft',
      genre: 'romance',
      rating: 'Mature',
      privacy: { localOnly: true, analyticsEnabled: false, retentionDays: 7 },
    });

    const redacted = privacy.redactLog('Private Draft includes phone 555-123-4567 and email writer@example.com.');
    privacy.deleteProject(project.id);

    expect(redacted).toContain('[phone]');
    expect(redacted).toContain('[email]');
    expect(projects.findProject(project.id)).toBeUndefined();
  });

  it('reports degraded creative mode when no capable provider is available', () => {
    const detector = new CreativeCapabilityDetector();

    const report = detector.evaluate([
      { provider: 'template', model: 'template', maxTokens: 1000, qualityScore: 0.3 },
    ]);

    expect(report.degraded).toBe(true);
    expect(report.missingCapabilities).toEqual(expect.arrayContaining(['long_context', 'creative_quality']));
    expect(report.userMessage).toContain('limited fallback mode');
  });

  it('creates, applies, exports, imports, and deletes prompt packs', () => {
    const library = new PromptPackLibrary();
    const pack = library.create({
      name: 'Noir Revision',
      category: 'tone_profile',
      prompts: [{ id: 'tension', title: 'Raise tension', text: 'Add suspicion and subtext.' }],
    });

    const applied = library.apply(pack.id, 'tension', 'Revise this scene.');
    const exported = library.export(pack.id);
    const imported = library.import(exported);
    library.delete(pack.id);

    expect(applied).toContain('Add suspicion and subtext.');
    expect(imported.name).toBe('Noir Revision');
    expect(library.find(pack.id)).toBeUndefined();
  });
});
