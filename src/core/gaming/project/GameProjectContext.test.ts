import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSessionFixture } from './__tests__/SessionFixture';
import { GameProjectContext } from './GameProjectContext';
import { ApprovedRepositoryGateway } from '../../coding/security/ApprovedRepositoryGateway';
import { projectOperationLocks } from './ProjectOperationLocks';
import { createProjectFilePolicy } from './ProjectFilePolicy';
import { captureFiles } from '../../coding/integrations/ToolWorkspace';
import { selectAutomaticContext } from '../../coding/integrations/AutomaticContext';
import { GameProjectSessions } from './GameProjectSessions';

describe('G01.3 source context freshness and physical exclusion', () => {
  let root: string, directory: string, fixture: Awaited<ReturnType<typeof createSessionFixture>>, service: GameProjectContext;
  const owner = { ownerId: 'alice', tenantId: 'local' };
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-core-')); directory = path.join(root, 'game');
    fixture = await createSessionFixture(root); fixture.writeProject(directory); service = new GameProjectContext(fixture.registry);
    fs.writeFileSync(path.join(directory, 'Main.gd'), 'extends Node\n');
  });
  afterEach(async () => { await fixture.close(); jest.restoreAllMocks(); expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });

  it('rejects source drift during selection instead of returning a stale content/hash snapshot', async () => {
    const project = await fixture.enroll(directory, 'godot', owner);
    const read = ApprovedRepositoryGateway.prototype.readTextFile;
    let changed = false;
    jest.spyOn(ApprovedRepositoryGateway.prototype, 'readTextFile').mockImplementation(function (this: ApprovedRepositoryGateway, file, maximum) {
      const result = read.call(this, file, maximum);
      if (file === 'Main.gd' && !changed) { changed = true; fs.appendFileSync(path.join(directory, file), '# external edit\n'); }
      return result;
    });
    await expect(service.select(owner, project.projectId, ['Main.gd'], '', false)).rejects.toMatchObject({ code: 'PROJECT_CONTEXT_STALE' });
  });

  it('uses the same physical exclusion lock as session native/mutation work across owners', async () => {
    const project = await fixture.enroll(directory, 'godot', owner);
    const bob = { ownerId: 'bob', tenantId: 'local' }; await fixture.enroll(directory, 'godot', bob);
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const pending = projectOperationLocks.run(project.physicalKey, async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); });
    await ready;
    try { await expect(service.select(bob, project.projectId, ['Main.gd'], '', false)).rejects.toMatchObject({ code: 'PROJECT_BUSY' }); }
    finally { release(); await pending; }
    expect((await service.select(owner, project.projectId, ['Main.gd'], '', false)).summary).toHaveLength(1);
  });

  it('reports supporting dependencies left beyond the conservative depth bound', () => {
    fs.writeFileSync(path.join(directory, 'Main.gd'), 'extends Node\nconst A = preload("res://A.gd")');
    for (const [name, target] of [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', '']]) fs.writeFileSync(path.join(directory, `${name}.gd`), `extends Node\n${target ? `const Next = preload("res://${target}.gd")` : ''}`);
    const filePolicy = createProjectFilePolicy('godot');
    const context = selectAutomaticContext(directory, captureFiles(directory, ['Main.gd'], 16000, 12, filePolicy), [], '', true, { filePolicy });
    expect(context.readOnly.map(file => file.path)).toEqual(['A.gd', 'B.gd']);
    expect(context.omissions).toContainEqual({ path: 'C.gd', reason: expect.stringContaining('depth limit') });
  });

  it('rechecks file roles and links at apply after approval so an alias cannot redirect a source write into a generated cache', async () => {
    const project = await fixture.enroll(directory, 'godot', owner), sessions = new GameProjectSessions(fixture.registry, fixture.bridgeFactory);
    const session = await sessions.connect(owner, project.projectId);
    fs.mkdirSync(path.join(directory, 'scripts')); fs.mkdirSync(path.join(directory, '.godot'));
    for (const folder of ['scripts', '.godot']) fs.writeFileSync(path.join(directory, folder, 'Player.gd'), 'extends Node\n# unchanged\n');
    const proposal = await sessions.propose(owner, session.sessionId, { title: 'Scope race regression', description: '', risk: 'low',
      actions: [{ type: 'update_script', targetPath: 'scripts/Player.gd', params: { content: 'extends Node\n# unsafe write\n' } }] });
    const approval = await sessions.approve(owner, session.sessionId, proposal.id);
    fs.renameSync(path.join(directory, 'scripts'), path.join(directory, 'original-scripts'));
    fs.symlinkSync(path.join(directory, '.godot'), path.join(directory, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(sessions.apply(owner, session.sessionId, proposal.id, approval.approvalDigest!)).rejects.toMatchObject({ code: 'PROJECT_FILE_PATH_UNSAFE' });
    expect(fs.readFileSync(path.join(directory, '.godot/Player.gd'), 'utf8')).toContain('# unchanged');
  });

  it('rechecks live targets before rollback so an in-project link cannot overwrite protected source metadata', async () => {
    const project = await fixture.enroll(directory, 'godot', owner), sessions = new GameProjectSessions(fixture.registry, fixture.bridgeFactory);
    const session = await sessions.connect(owner, project.projectId);
    fs.mkdirSync(path.join(directory, 'scripts')); fs.mkdirSync(path.join(directory, '.godot'));
    fs.writeFileSync(path.join(directory, 'scripts/Player.gd'), 'extends Node\n# original\n'); fs.writeFileSync(path.join(directory, '.godot/Player.gd'), 'CACHE_MUST_REMAIN');
    const proposal = await sessions.propose(owner, session.sessionId, { title: 'Rollback role regression', description: '', risk: 'low',
      actions: [{ type: 'update_script', targetPath: 'scripts/Player.gd', params: { content: 'extends Node\n# applied\n' } }] });
    const approval = await sessions.approve(owner, session.sessionId, proposal.id), transaction = await sessions.apply(owner, session.sessionId, proposal.id, approval.approvalDigest!);
    fs.renameSync(path.join(directory, 'scripts'), path.join(directory, 'original-scripts'));
    fs.symlinkSync(path.join(directory, '.godot'), path.join(directory, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(sessions.rollback(owner, session.sessionId, transaction.id)).rejects.toMatchObject({ code: 'PROJECT_FILE_PATH_UNSAFE' });
    expect(fs.readFileSync(path.join(directory, '.godot/Player.gd'), 'utf8')).toBe('CACHE_MUST_REMAIN');
  });
});
