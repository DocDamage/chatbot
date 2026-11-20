import crypto from 'node:crypto';
import { GameEngineBridge, IGameEngineAdapter } from '../engine/GameEngineBridge';
import { EngineAssertion, EngineAssertionReport, EngineExportPreset, EngineMutationAction, EngineMutationProposal, EngineStatus } from '../engine/GameEngineTypes';
import { copyJson } from '../engine/EngineProposalIntegrity';
import { digestJson } from '../engine/CanonicalJson';
import { GameProjectRegistry } from './GameProjectRegistry';
import { EnrolledProject, ProjectOwner, ProjectEnrollmentError } from './ProjectEnrollmentTypes';
import { ProjectSessionBinding, ProjectSessionView } from './ProjectSessionTypes';
import { ProjectBridgeFactory } from './ProjectBridgeFactory';
import { projectOperationLocks } from './ProjectOperationLocks';
import { guardDescriptorMutations, guardSessionEvidence, guardNativeWritePaths, sessionPath } from './ProjectSessionGuards';

interface SessionRecord {
  owner: ProjectOwner; project: EnrolledProject; binding: ProjectSessionBinding; bridge: GameEngineBridge; key: string;
  proposalActions: Map<string, EngineMutationAction[]>;
  transactionActions: Map<string, EngineMutationAction[]>;
}
const ownedBridges = new WeakSet<GameEngineBridge>();
const ownedAdapters = new WeakSet<IGameEngineAdapter>();

/** Process-local sessions. Every engine operation uses an immutable enrollment and a physical-project lock. */
export class GameProjectSessions {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly keys = new Map<string, string>();
  private opening = 0;
  constructor(private readonly registry: GameProjectRegistry, private readonly factory: ProjectBridgeFactory, private readonly maximum = 64) {}

  private engine(project: EnrolledProject): 'godot' | 'unity' | 'unreal' {
    const engine = project.profile.facts.engine;
    if (project.profile.resolution !== 'resolved' || !project.profile.runtime || engine === 'rpg-maker-mz') throw new ProjectEnrollmentError('PROJECT_PROFILE_UNRESOLVED', 'Resolve the enrolled project/runtime profile before opening an engine session.');
    return engine;
  }
  private record(owner: ProjectOwner, id: string): SessionRecord {
    const record = this.sessions.get(id);
    if (!record || record.owner.ownerId !== owner.ownerId || record.owner.tenantId !== owner.tenantId) throw new ProjectEnrollmentError('PROJECT_SESSION_NOT_FOUND', 'Session not found for this owner.', 404);
    return record;
  }
  private view(record: SessionRecord): ProjectSessionView {
    const { sessionId, projectId, profileDigest, profileRevision, runtimeId } = record.binding;
    return structuredClone({ ...record.bridge.getStatus(this.engine(record.project)), sessionId, projectId, profileDigest, profileRevision, runtimeId });
  }
  public list(owner: ProjectOwner): ProjectSessionView[] {
    return [...this.sessions.values()].filter(record => record.owner.ownerId === owner.ownerId && record.owner.tenantId === owner.tenantId).map(record => this.view(record));
  }
  public validateSelector(owner: ProjectOwner, id: string, engine?: unknown, projectId?: unknown): void {
    const record = this.record(owner, id);
    if ((engine !== undefined && engine !== record.project.profile.facts.engine) || (projectId !== undefined && projectId !== record.project.projectId)) throw new ProjectEnrollmentError('PROJECT_SESSION_SELECTOR_MISMATCH', 'Engine/project selectors must match the selected session.', 400);
  }
  private async fresh(record: SessionRecord): Promise<void> {
    const project = await this.registry.get(record.owner, record.project.projectId);
    const binding = record.binding;
    if (project.physicalKey !== binding.physicalKey || project.profile.profileDigest !== binding.profileDigest || project.revision !== binding.profileRevision ||
      project.profile.runtime?.runtimeId !== binding.runtimeId || project.profile.resolution !== 'resolved') throw new ProjectEnrollmentError('PROJECT_SESSION_STALE', 'The session profile/revision/runtime changed; connect a new session.');
    this.assertStatus(record.project, record.bridge.getStatus(this.engine(record.project)));
  }
  private assertStatus(project: EnrolledProject, status: EngineStatus): void {
    if (status.state !== 'connected' || status.engine !== project.profile.facts.engine || status.projectPath !== project.canonicalRoot || status.version !== project.profile.runtime?.exactVersion) {
      throw new ProjectEnrollmentError('PROJECT_SESSION_BINDING_MISMATCH', 'The adapter does not match the enrolled project/root/runtime.');
    }
  }
  public async connect(owner: ProjectOwner, projectId: string, expectedEngine?: string): Promise<ProjectSessionView> {
    const project = await this.registry.get(owner, projectId);
    const engine = this.engine(project);
    if (expectedEngine && expectedEngine !== engine) throw new ProjectEnrollmentError('PROJECT_ENGINE_MISMATCH', 'The requested engine does not match the enrollment.', 400);
    return projectOperationLocks.run(project.physicalKey, async () => {
      const current = await this.registry.get(owner, projectId);
      this.engine(current);
      const runtime = current.profile.runtime!;
      const key = digestJson('project-session-key:v1', { owner, projectId, revision: current.revision, profileDigest: current.profile.profileDigest, runtimeId: runtime.runtimeId });
      const existing = this.keys.get(key);
      if (existing) { const record = this.record(owner, existing); await this.fresh(record); return this.view(record); }
      if (this.sessions.size + this.opening >= this.maximum) throw new ProjectEnrollmentError('PROJECT_SESSION_LIMIT', 'Disconnect unused sessions before opening another.');
      this.opening++;
      let bridge: GameEngineBridge | undefined;
      let owned = false;
      try {
        bridge = this.factory(copyJson(current));
        const adapter = bridge.getAdapter(engine);
        if (ownedBridges.has(bridge) || ownedAdapters.has(adapter)) throw new ProjectEnrollmentError('PROJECT_SESSION_FACTORY_REUSED', 'A mutable bridge/adapter was reused across sessions.', 500);
        ownedBridges.add(bridge); ownedAdapters.add(adapter);
        owned = true;
        const status = await bridge.connect({ engine, projectRoot: current.canonicalRoot, versionOverride: runtime.exactVersion });
        this.assertStatus(current, status);
        const binding: ProjectSessionBinding = { sessionId: crypto.randomUUID(), projectId, profileDigest: current.profile.profileDigest,
          profileRevision: current.revision, runtimeId: runtime.runtimeId, physicalKey: current.physicalKey };
        const record: SessionRecord = { owner: { ...owner }, project: copyJson(current), bridge, binding, key, proposalActions: new Map(), transactionActions: new Map() };
        await this.fresh(record);
        this.sessions.set(binding.sessionId, record); this.keys.set(key, binding.sessionId);
        return this.view(record);
      } catch (error) {
        if (bridge && owned) await bridge.disconnect(engine);
        throw error;
      } finally { this.opening--; }
    });
  }
  private async run<T>(owner: ProjectOwner, id: string, work: (record: SessionRecord) => Promise<T>, recover?: (record: SessionRecord, result: T) => Promise<void>): Promise<T> {
    const record = this.record(owner, id);
    return projectOperationLocks.run(record.binding.physicalKey, async () => {
      this.record(owner, id); await this.fresh(record);
      const result = await work(record);
      try { await this.fresh(record); }
      catch (error) { if (recover) await recover(record, result); throw error; }
      return result;
    });
  }
  public async status(owner: ProjectOwner, id: string): Promise<ProjectSessionView> {
    return this.run(owner, id, async record => this.view(record));
  }
  public async disconnect(owner: ProjectOwner, id: string): Promise<void> {
    const record = this.record(owner, id);
    await projectOperationLocks.run(record.binding.physicalKey, async () => {
      await record.bridge.disconnect(this.engine(record.project));
      this.sessions.delete(id); if (this.keys.get(record.key) === id) this.keys.delete(record.key);
    });
  }
  public async inspect(owner: ProjectOwner, id: string, kind: 'project' | 'scene' | 'script', requested?: string): Promise<unknown> {
    return this.run(owner, id, async record => {
      const engine = this.engine(record.project);
      if (kind === 'project') return record.bridge.inspectProject(engine);
      sessionPath(record.project, requested!);
      const relative = requested!.startsWith('res://') ? requested!.slice(6) : requested!;
      return kind === 'scene' ? record.bridge.inspectScene(engine, relative) : record.bridge.inspectScript(engine, relative);
    });
  }
  public async propose(owner: ProjectOwner, id: string, draft: { title: string; description: string; risk: EngineMutationProposal['risk']; actions: EngineMutationAction[] }): Promise<EngineMutationProposal> {
    return this.run(owner, id, async record => {
      guardDescriptorMutations(record.project, draft.actions);
      const proposal = await record.bridge.proposeMutation(this.engine(record.project), { ...copyJson(draft), engine: this.engine(record.project),
        projectId: record.project.projectId, requesterId: owner.ownerId, tenantId: owner.tenantId, projectScope: copyJson(record.binding) });
      record.proposalActions.set(proposal.id, copyJson(proposal.actions)); return proposal;
    });
  }
  public async approve(owner: ProjectOwner, id: string, proposalId: string): Promise<EngineMutationProposal> {
    return this.run(owner, id, record => {
      const actions = record.proposalActions.get(proposalId); if (actions) guardDescriptorMutations(record.project, actions);
      return record.bridge.approveMutation(this.engine(record.project), proposalId, owner.ownerId);
    });
  }
  public async apply(owner: ProjectOwner, id: string, proposalId: string, approvalDigest: string) {
    return this.run(owner, id, async record => {
      const actions = record.proposalActions.get(proposalId); if (actions) guardDescriptorMutations(record.project, actions);
      const transaction = await record.bridge.applyMutation(this.engine(record.project), proposalId, approvalDigest, { callerId: owner.ownerId, tenantId: owner.tenantId });
      record.transactionActions.set(transaction.id, copyJson(transaction.actions));
      return { ...transaction, projectScope: copyJson(record.binding) };
    }, async (record, result) => {
      try {
        this.registry.assertPhysicalIdentity(record.project);
        guardDescriptorMutations(record.project, result.actions);
        await record.bridge.rollbackTransaction(this.engine(record.project), result.id);
      } catch {
        throw new ProjectEnrollmentError('PROJECT_SESSION_RECOVERY_REQUIRED', `Post-apply scope validation failed; transaction ${result.id} needs explicit recovery. No success was published.`, 500);
      }
    });
  }
  public async rollback(owner: ProjectOwner, id: string, transactionId: string): Promise<boolean> {
    return this.run(owner, id, record => {
      const actions = record.transactionActions.get(transactionId); if (actions) guardDescriptorMutations(record.project, actions);
      return record.bridge.rollbackTransaction(this.engine(record.project), transactionId);
    });
  }
  public async scenario(owner: ProjectOwner, id: string, input: { scenePath?: string; headless?: boolean }, assertions: EngineAssertion[]): Promise<EngineAssertionReport> {
    const requested = copyJson(assertions);
    return this.run(owner, id, async record => {
      if (input.scenePath) sessionPath(record.project, input.scenePath);
      guardNativeWritePaths(record.project);
      const scopeDigest = digestJson('project-session-attempt:v1', { ...record.binding, owner, attemptId: crypto.randomUUID() });
      const options = { ...(input.scenePath ? { scenePath: input.scenePath } : {}), headless: input.headless ?? true, scopeDigest };
      const report = await record.bridge.runRuntimeScenario(this.engine(record.project), options, requested);
      guardSessionEvidence(record.project, report, requested, options.scenePath || '', scopeDigest);
      return { ...report, projectScope: copyJson(record.binding) };
    });
  }
  public async profile(owner: ProjectOwner, id: string) {
    return this.run(owner, id, record => { guardNativeWritePaths(record.project); return record.bridge.profilePerformance(this.engine(record.project)); });
  }
  public async export(owner: ProjectOwner, id: string, preset: EngineExportPreset) {
    return this.run(owner, id, record => {
      sessionPath(record.project, preset.exportPath); sessionPath(record.project, 'builds');
      guardNativeWritePaths(record.project);
      return record.bridge.exportProject(this.engine(record.project), preset);
    });
  }
}
