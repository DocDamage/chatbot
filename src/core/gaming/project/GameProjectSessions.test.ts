import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSessionFixture } from './__tests__/SessionFixture';
import { GameProjectSessions } from './GameProjectSessions';
import { scenarioBinding } from '../engine/NativeScenarioEvidence';
import { EngineAssertionReport, EngineMutationProposal } from '../engine/GameEngineTypes';
import { GodotMcpXAdapter } from '../godot/GodotMcpXAdapter';
import { ProjectBridgeFactory } from './ProjectBridgeFactory';

describe('G01.2 owner/project/runtime-scoped engine sessions (fixture backends)', () => {
  let root: string, one: string, two: string;
  let fixture: Awaited<ReturnType<typeof createSessionFixture>>;
  let service: GameProjectSessions;
  let scenario: jest.Mock;
  const owner = { ownerId: 'alice', tenantId: 'local' };
  const bob = { ownerId: 'bob', tenantId: 'local' };
  const draft = { title: 'Scoped change', description: '', risk: 'low' as const,
    actions: [{ type: 'create_script' as const, targetPath: 'Created.gd', params: { content: 'extends Node\n' } }] };
  const assertions = [{ type: 'node_exists' as const, target: 'Player', expected: true }];
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-sessions-')); one = path.join(root, 'one'); two = path.join(root, 'two');
    scenario = jest.fn(async (projectRoot, options, requested) => ({ scenarioName: options.scenePath || 'fixture', passed: true, checkKind: 'scene_observation', durationMs: 1,
      evidence: scenarioBinding('godot', projectRoot, options.scenePath || '', requested, options.scopeDigest),
      assertions: requested.map((item: any) => ({ ...item, actual: item.expected, passed: true })), capturedLogs: [] }));
    fixture = await createSessionFixture(root, { runScenario: scenario });
    fixture.writeProject(one); fixture.writeProject(two);
    for (const directory of [one, two]) fs.writeFileSync(path.join(directory, 'Main.tscn'), `[gd_scene format=3]\n[node name="${path.basename(directory)}" type="Node"]\n`);
    service = new GameProjectSessions(fixture.registry, fixture.bridgeFactory);
  });
  afterEach(async () => { await fixture.close(); expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });
  const connect = async (directory: string, actor = owner, target = service) => target.connect(actor, (await fixture.enroll(directory, 'godot', actor)).projectId);
  const approved = async (id: string, actor = owner, target = service) => {
    const proposal = await target.propose(actor, id, draft);
    return target.approve(actor, id, proposal.id);
  };

  it('keeps concurrent same-engine projects in separate adapters, roots, proposal/rollback stores and exact versions', async () => {
    const [a, b] = await Promise.all([connect(one), connect(two)]);
    expect(a.sessionId).not.toBe(b.sessionId); expect(a.version).toBe('4.7.1.stable.official.fixture');
    expect((await service.inspect(owner, a.sessionId, 'project') as any).engineVersion).toBe(a.version);
    expect((await service.inspect(owner, a.sessionId, 'scene', 'Main.tscn') as any).rootNode.name).toBe('one');
    expect((await service.inspect(owner, b.sessionId, 'scene', 'Main.tscn') as any).rootNode.name).toBe('two');
    const proposal = await approved(a.sessionId);
    expect(proposal.projectScope).toMatchObject({ sessionId: a.sessionId, profileDigest: a.profileDigest, runtimeId: a.runtimeId });
    await expect(service.apply(owner, b.sessionId, proposal.id, proposal.approvalDigest!)).rejects.toThrow('not found');
    const transaction = await service.apply(owner, a.sessionId, proposal.id, proposal.approvalDigest!);
    expect(fs.existsSync(path.join(one, 'Created.gd'))).toBe(true); expect(fs.existsSync(path.join(two, 'Created.gd'))).toBe(false);
    expect(await service.rollback(owner, b.sessionId, transaction.id)).toBe(false);
    expect(await service.rollback(owner, a.sessionId, transaction.id)).toBe(true);
    expect(fs.existsSync(path.join(one, 'Created.gd'))).toBe(false);
  });

  it('does not expose or operate another owner/tenant session and keeps returned views detached', async () => {
    const a = await connect(one);
    expect(service.list(bob)).toEqual([]);
    await expect(service.status(bob, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_SESSION_NOT_FOUND' });
    await expect(service.disconnect({ ...owner, tenantId: 'foreign' }, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_SESSION_NOT_FOUND' });
    a.projectPath = two; a.runtimeId = 'spoofed';
    expect((await service.status(owner, a.sessionId)).projectPath).toBe(one);
    const original = await fixture.registry.enroll(owner, one, 'godot', { selectedRuntimeId: 'fixture-godot' });
    expect((await service.connect(owner, original.projectId)).sessionId).toBe(a.sessionId);
  });

  it('rejects unresolved, wrong-engine, stale and moved identities before any source writer runs', async () => {
    const unresolved = await fixture.registry.enroll(owner, one, 'godot');
    await expect(service.connect(owner, unresolved.projectId)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_UNRESOLVED' });
    await fixture.registry.refresh(owner, unresolved.projectId, 1, { selectedRuntimeId: 'fixture-godot' });
    await expect(service.connect(owner, unresolved.projectId, 'unreal')).rejects.toMatchObject({ code: 'PROJECT_ENGINE_MISMATCH' });
    const a = await service.connect(owner, unresolved.projectId);
    const proposal = await approved(a.sessionId);
    fs.appendFileSync(path.join(one, 'project.godot'), '# external config edit');
    await expect(service.apply(owner, a.sessionId, proposal.id, proposal.approvalDigest!)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_STALE' });
    expect(fs.existsSync(path.join(one, 'Created.gd'))).toBe(false);
    const refreshed = await fixture.registry.refresh(owner, unresolved.projectId, 2);
    await expect(service.status(owner, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_SESSION_STALE' });
    const next = await service.connect(owner, refreshed.projectId);
    expect(next.sessionId).not.toBe(a.sessionId);
    await expect(service.apply(owner, next.sessionId, proposal.id, proposal.approvalDigest!)).rejects.toThrow('not found');
    fs.renameSync(one, path.join(root, 'moved'));
    await expect(service.inspect(owner, next.sessionId, 'project')).rejects.toMatchObject({ code: 'PROJECT_ROOT_MISSING' });
  });

  it('shares physical-project exclusion across owners, path aliases, separate managers and profile refresh', async () => {
    const alias = path.join(root, 'alias'); fs.symlinkSync(one, alias, process.platform === 'win32' ? 'junction' : 'dir');
    const otherManager = new GameProjectSessions(fixture.registry, fixture.bridgeFactory);
    const a = await connect(one), b = await connect(alias, bob, otherManager), independent = await connect(two);
    const bProposal = await approved(b.sessionId, bob, otherManager), independentProposal = await approved(independent.sessionId);
    let release!: () => void; let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const original = scenario.getMockImplementation()!;
    scenario.mockImplementationOnce(async (...args) => { entered(); await new Promise<void>(resolve => { release = resolve; }); return original(...args); });
    const running = service.scenario(owner, a.sessionId, {}, assertions); await started;
    await expect(otherManager.apply(bob, b.sessionId, bProposal.id, bProposal.approvalDigest!)).rejects.toMatchObject({ code: 'PROJECT_BUSY' });
    await expect(fixture.registry.refresh(bob, b.projectId, 1)).rejects.toMatchObject({ code: 'PROJECT_BUSY' });
    await expect(service.disconnect(owner, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_BUSY' });
    await service.apply(owner, independent.sessionId, independentProposal.id, independentProposal.approvalDigest!);
    expect(fs.existsSync(path.join(two, 'Created.gd'))).toBe(true);
    release(); expect((await running).passed).toBe(true);
    await otherManager.apply(bob, b.sessionId, bProposal.id, bProposal.approvalDigest!);
    expect(fs.existsSync(path.join(one, 'Created.gd'))).toBe(true);
  });

  it('rejects replayed/foreign evidence even for the same physical root and binds fresh attempts', async () => {
    const a = await connect(one), b = await connect(one, bob);
    const result = await service.scenario(owner, a.sessionId, {}, assertions);
    expect(result).toMatchObject({ passed: true, projectScope: { sessionId: a.sessionId } });
    scenario.mockResolvedValueOnce(result);
    await expect(service.scenario(bob, b.sessionId, {}, assertions)).rejects.toMatchObject({ code: 'SESSION_EVIDENCE_MISMATCH' });
    scenario.mockResolvedValueOnce(result);
    await expect(service.scenario(owner, a.sessionId, {}, assertions)).rejects.toMatchObject({ code: 'SESSION_EVIDENCE_MISMATCH' });
  });

  it('does not publish a late result after profile drift and rolls back a completed source apply', async () => {
    const bridges: ReturnType<ProjectBridgeFactory>[] = [];
    const factory: ProjectBridgeFactory = project => {
      const bridge = fixture.bridgeFactory(project); bridges.push(bridge); return bridge;
    };
    service = new GameProjectSessions(fixture.registry, factory);
    const a = await connect(one); const proposal = await approved(a.sessionId);
    const apply = bridges[0].applyMutation.bind(bridges[0]);
    jest.spyOn(bridges[0], 'applyMutation').mockImplementationOnce(async (...args) => {
      const transaction = await apply(...args); fs.appendFileSync(path.join(one, 'project.godot'), '# changed during apply'); return transaction;
    });
    await expect(service.apply(owner, a.sessionId, proposal.id, proposal.approvalDigest!)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_STALE' });
    expect(fs.existsSync(path.join(one, 'Created.gd'))).toBe(false);
    expect(fs.readFileSync(path.join(one, 'project.godot'), 'utf8')).toContain('changed during apply');
    expect((bridges[0].getAdapter('godot') as GodotMcpXAdapter).getTransactionManager().getProposal(proposal.id).status).toBe('rolled_back');
  });

  it('guards configuration identity and confined scene/export paths before backend dispatch', async () => {
    const a = await connect(one);
    await expect(service.propose(owner, a.sessionId, { ...draft, actions: [{ type: 'custom', targetPath: 'project.godot', params: { content: 'tampered' } }] })).rejects.toMatchObject({ code: 'PROJECT_CONFIGURATION_EDIT_REQUIRES_REFRESH' });
    await expect(service.scenario(owner, a.sessionId, { scenePath: '../escape.tscn' }, assertions)).rejects.toThrow();
    await expect(service.export(owner, a.sessionId, { name: 'fixture', platform: 'windows', exportPath: '../escape.exe', templateVersion: 'fixture' })).rejects.toThrow();
    const external = path.join(root, 'external-cache'); fs.mkdirSync(external);
    fs.symlinkSync(external, path.join(one, '.chatbot-instrumentation'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(service.scenario(owner, a.sessionId, {}, assertions)).rejects.toThrow('link outside');
    expect(scenario).not.toHaveBeenCalled();
  });

  it('does not redirect rollback through a replaced project-local junction', async () => {
    const a = await connect(one); fs.mkdirSync(path.join(one, 'scripts'));
    fs.writeFileSync(path.join(one, 'scripts/Created.gd'), 'extends Node\n# original');
    const proposal = await service.propose(owner, a.sessionId, { ...draft, actions: [{ type: 'update_script', targetPath: 'scripts/Created.gd', params: { content: 'extends Node\n# changed' } }] });
    const approval = await service.approve(owner, a.sessionId, proposal.id);
    const tx = await service.apply(owner, a.sessionId, proposal.id, approval.approvalDigest!);
    const moved = path.join(root, 'external-scripts'); fs.renameSync(path.join(one, 'scripts'), moved);
    fs.symlinkSync(moved, path.join(one, 'scripts'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(service.rollback(owner, a.sessionId, tx.id)).rejects.toThrow('link outside');
    expect(fs.readFileSync(path.join(moved, 'Created.gd'), 'utf8')).toContain('changed');
  });

  it('refuses a reused factory without disconnecting the original session', async () => {
    const project = await fixture.enroll(one, 'godot', owner);
    const shared = fixture.bridgeFactory(project);
    service = new GameProjectSessions(fixture.registry, () => shared);
    const a = await service.connect(owner, project.projectId);
    await expect(connect(two)).rejects.toMatchObject({ code: 'PROJECT_SESSION_FACTORY_REUSED' });
    expect((await service.status(owner, a.sessionId)).state).toBe('connected');
  });

  it('retires sessions explicitly and keeps process-local grants out of a new manager', async () => {
    const a = await connect(one); const proposal = await approved(a.sessionId);
    const restarted = new GameProjectSessions(fixture.registry, fixture.bridgeFactory);
    await expect(restarted.status(owner, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_SESSION_NOT_FOUND' });
    const next = await connect(one, owner, restarted);
    await expect(restarted.apply(owner, next.sessionId, proposal.id, proposal.approvalDigest!)).rejects.toThrow('not found');
    await service.disconnect(owner, a.sessionId);
    await expect(service.status(owner, a.sessionId)).rejects.toMatchObject({ code: 'PROJECT_SESSION_NOT_FOUND' });
  });
});
