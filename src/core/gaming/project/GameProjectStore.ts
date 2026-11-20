import { Database } from '../../database/Database';
import { EnrolledProject, ProjectEnrollmentError, ProjectOwner } from './ProjectEnrollmentTypes';
import { projectProfileDigest } from './ProjectProfileResolver';

/** Owner/tenant predicates are required on every read/write, including revision updates. */
export class GameProjectStore {
  constructor(private readonly database: Database) {}

  private supported(): void {
    if (this.database.getType() !== 'sqlite') throw new ProjectEnrollmentError('PROJECT_STORE_UNAVAILABLE', 'Project enrollment requires the qualified SQLite store.', 503);
  }

  public async list(owner: ProjectOwner): Promise<EnrolledProject[]> {
    this.supported();
    const result = await this.database.query('SELECT * FROM game_enrolled_projects WHERE owner_id = ? AND tenant_id = ? ORDER BY updated_at DESC LIMIT 200', [owner.ownerId, owner.tenantId]);
    return result.rows.map(row => this.decode(row));
  }

  public async get(owner: ProjectOwner, projectId: string): Promise<EnrolledProject | undefined> {
    this.supported();
    const result = await this.database.query('SELECT * FROM game_enrolled_projects WHERE owner_id = ? AND tenant_id = ? AND project_id = ?', [owner.ownerId, owner.tenantId, projectId]);
    return result.rows[0] ? this.decode(result.rows[0]) : undefined;
  }

  public async findRoot(owner: ProjectOwner, canonicalRoot: string): Promise<EnrolledProject | undefined> {
    this.supported();
    const result = await this.database.query('SELECT * FROM game_enrolled_projects WHERE owner_id = ? AND tenant_id = ? AND canonical_root = ?', [owner.ownerId, owner.tenantId, canonicalRoot]);
    return result.rows[0] ? this.decode(result.rows[0]) : undefined;
  }

  public async create(project: EnrolledProject): Promise<EnrolledProject> {
    this.supported();
    const result = await this.database.query(`INSERT INTO game_enrolled_projects
      (owner_id, tenant_id, project_id, canonical_root, physical_key, filesystem_identity, profile_json, profile_digest, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    [project.ownerId, project.tenantId, project.projectId, project.canonicalRoot, project.physicalKey, project.filesystemIdentity,
      JSON.stringify(project.profile), project.profile.profileDigest, project.revision, project.createdAt, project.updatedAt]);
    if (result.rowCount !== 1) throw new ProjectEnrollmentError('PROJECT_ENROLLMENT_CONFLICT', 'This root/project was enrolled concurrently; reload its enrollment before continuing.');
    return project;
  }

  public async update(project: EnrolledProject, expectedRevision: number): Promise<EnrolledProject> {
    this.supported();
    const result = await this.database.query(`UPDATE game_enrolled_projects SET profile_json = ?, profile_digest = ?, revision = ?, updated_at = ?
      WHERE owner_id = ? AND tenant_id = ? AND project_id = ? AND revision = ? AND physical_key = ?`,
    [JSON.stringify(project.profile), project.profile.profileDigest, expectedRevision + 1, project.updatedAt,
      project.ownerId, project.tenantId, project.projectId, expectedRevision, project.physicalKey]);
    if (result.rowCount !== 1) throw new ProjectEnrollmentError('PROJECT_REVISION_CONFLICT', 'The project profile changed; reload it before refreshing.');
    return { ...project, revision: expectedRevision + 1 };
  }

  private decode(row: any): EnrolledProject {
    const profile = JSON.parse(row.profile_json);
    const { profileDigest, observedAt: _observedAt, ...scope } = profile;
    const identity = { canonicalRoot: row.canonical_root, physicalKey: row.physical_key, filesystemIdentity: row.filesystem_identity };
    if (profileDigest !== row.profile_digest || projectProfileDigest(identity, scope) !== row.profile_digest) throw new ProjectEnrollmentError('PROJECT_PROFILE_CORRUPT', 'The stored profile digest is inconsistent.', 500);
    return { ownerId: row.owner_id, tenantId: row.tenant_id, projectId: row.project_id, canonicalRoot: row.canonical_root,
      physicalKey: row.physical_key, filesystemIdentity: row.filesystem_identity, profile, revision: row.revision,
      createdAt: row.created_at, updatedAt: row.updated_at };
  }
}
