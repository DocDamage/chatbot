import { resolveDeploymentMode, RuntimeProfile } from '../../config/EnvironmentDefinitions';
import { GameEngineError } from '../engine/GameEngineTypes';
import { copyJson } from '../engine/EngineProposalIntegrity';
import { EngineKind } from './EngineVersions';
import { inspectProjectIdentity } from './ProjectIdentity';
import { GameProjectStore } from './GameProjectStore';
import { ProjectProfileResolver } from './ProjectProfileResolver';
import { executableHash } from './ProjectRuntimeCatalog';
import { readProjectFacts } from './ProjectFactsReader';
import { canonicalJson } from '../engine/CanonicalJson';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { EnrolledProject, ProfileSelection, ProjectEnrollmentError, ProjectOwner } from './ProjectEnrollmentTypes';
import { projectOperationLocks } from './ProjectOperationLocks';

export class GameProjectRegistry {
  constructor(private readonly workspaceRoot: string, private readonly store: GameProjectStore,
    readonly resolver: ProjectProfileResolver, private readonly mode: RuntimeProfile = resolveDeploymentMode()) {}

  private authorize(owner: ProjectOwner): void {
    if (this.mode === 'hosted') throw new GameEngineError('HOSTED_MODE_DENIED', 'Local project enrollment is unavailable in hosted deployments.');
    if (!owner.ownerId?.trim() || !owner.tenantId?.trim()) throw new ProjectEnrollmentError('PROJECT_OWNER_REQUIRED', 'An authenticated project owner and server tenant are required.', 401);
  }

  public async list(owner: ProjectOwner): Promise<EnrolledProject[]> {
    this.authorize(owner);
    return this.store.list(owner);
  }

  public async enroll(owner: ProjectOwner, root: string, engine: EngineKind, selection: ProfileSelection = {}): Promise<EnrolledProject> {
    this.authorize(owner);
    if (!['godot', 'unity', 'unreal', 'rpg-maker-mz'].includes(engine)) throw new ProjectEnrollmentError('UNSUPPORTED_PROJECT_KIND', 'Select an enrollment kind qualified by this resolver.', 400);
    const identity = inspectProjectIdentity(this.workspaceRoot, root);
    const existing = await this.store.findRoot(owner, identity.canonicalRoot);
    if (existing) {
      if (existing.physicalKey !== identity.physicalKey) throw new ProjectEnrollmentError('PROJECT_ROOT_IDENTITY_CHANGED', 'This path now identifies a different physical directory; it cannot inherit the old enrollment.');
      if (existing.profile.facts.engine !== engine) throw new ProjectEnrollmentError('PROJECT_KIND_CONFLICT', 'A root cannot silently change its enrolled engine kind.');
      if (Object.keys(selection).length && canonicalJson(selection) !== canonicalJson(existing.profile.selection)) throw new ProjectEnrollmentError('PROJECT_REFRESH_REQUIRED', 'Use revision-checked profile refresh to change the selected runtime.');
      return this.get(owner, existing.projectId);
    }
    const profile = await this.resolver.resolve(identity, engine, copyJson(selection));
    const now = new Date().toISOString();
    const project: EnrolledProject = { ...identity, ...owner, projectId: `project-${identity.physicalKey}`, profile, revision: 1, createdAt: now, updatedAt: now };
    // A moved/swapped root or changed descriptor during a native probe must not become an enrollment.
    await this.validateCurrent(project);
    return this.store.create(project);
  }

  public async get(owner: ProjectOwner, id: string): Promise<EnrolledProject> {
    this.authorize(owner);
    const project = await this.store.get(owner, id);
    if (!project) throw new ProjectEnrollmentError('PROJECT_NOT_FOUND', 'Project enrollment not found for this owner.', 404);
    await this.validateCurrent(project);
    return project;
  }

  public async refresh(owner: ProjectOwner, id: string, expectedRevision: number, selection?: ProfileSelection): Promise<EnrolledProject> {
    this.authorize(owner);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new ProjectEnrollmentError('PROJECT_REVISION_REQUIRED', 'A positive expectedRevision is required.', 400);
    const enrolled = await this.store.get(owner, id);
    if (!enrolled) throw new ProjectEnrollmentError('PROJECT_NOT_FOUND', 'Project enrollment not found for this owner.', 404);
    return projectOperationLocks.run(enrolled.physicalKey, async () => {
      const project = (await this.store.get(owner, id))!;
      this.validateIdentity(project);
      if (project.revision !== expectedRevision) throw new ProjectEnrollmentError('PROJECT_REVISION_CONFLICT', 'Reload the current profile revision before refreshing.');
      const profile = await this.resolver.resolve(project, project.profile.facts.engine, copyJson(selection ?? project.profile.selection));
      const updated = { ...project, profile, updatedAt: new Date().toISOString() };
      await this.validateCurrent(updated);
      return this.store.update(updated, expectedRevision);
    });
  }

  public assertPhysicalIdentity(project: EnrolledProject): void { this.validateIdentity(project); }

  private validateIdentity(project: EnrolledProject): void {
    const current = inspectProjectIdentity(this.workspaceRoot, project.canonicalRoot);
    if (current.physicalKey !== project.physicalKey) throw new ProjectEnrollmentError('PROJECT_ROOT_IDENTITY_CHANGED', 'The project moved or this directory was replaced; explicit re-enrollment is required.');
  }

  private async validateCurrent(project: EnrolledProject): Promise<void> {
    this.validateIdentity(project);
    const observed = readProjectFacts(project.canonicalRoot, project.profile.facts.engine);
    if (canonicalJson(observed.descriptors) !== canonicalJson(project.profile.facts.descriptors)) throw new ProjectEnrollmentError('PROJECT_PROFILE_STALE', 'Project configuration changed; refresh the profile using its current revision.');
    if (project.profile.runtime) {
      const runtime = project.profile.runtime;
      try {
        if (await executableHash(runtime.executablePath) !== runtime.executableSha256) throw new Error('hash mismatch');
        if (runtime.buildMetadataPath && runtime.buildMetadataSha256) {
          const stat = fs.statSync(runtime.buildMetadataPath);
          if (!stat.isFile() || stat.size > 1_048_576 || crypto.createHash('sha256').update(fs.readFileSync(runtime.buildMetadataPath)).digest('hex') !== runtime.buildMetadataSha256) throw new Error('build metadata changed');
        }
      } catch { throw new ProjectEnrollmentError('PROJECT_RUNTIME_STALE', 'The enrolled executable is missing or changed; inspect and select the current runtime before refreshing.'); }
    }
  }
}
