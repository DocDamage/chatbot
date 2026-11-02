/**
 * Capability Platform SQLite Store (PX-02 / PX02-T11)
 * Local persistence layer executing schema migrations and storing
 * capability packs, installations, jobs, events, approvals, and artifacts.
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { SQLITE_CAPABILITY_SCHEMA } from './CapabilityMigrations';

export class CapabilitySqliteStore {
  private db: Database.Database;

  constructor(dbPath: string = path.join(process.cwd(), 'data', 'capability_platform.db')) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Fallback for memory db
      }
    }
    this.db = new Database(dbPath === ':memory:' ? ':memory:' : dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  public migrate(): void {
    this.db.exec(SQLITE_CAPABILITY_SCHEMA);
  }

  public saveJob(job: {
    id: string;
    capabilityId: string;
    packId: string;
    ownerId: string;
    projectId?: string;
    state: string;
    currentStage: string;
    progressPercent: number;
    inputDigest: string;
    approvalDigest?: string;
    resourceBudgetJson: string;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
    failureCategory?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO capability_jobs (
        id, capability_id, pack_id, owner_id, project_id, state,
        current_stage, progress_percent, input_digest, approval_digest,
        resource_budget_json, created_at, started_at, finished_at, error, failure_category
      ) VALUES (
        @id, @capabilityId, @packId, @ownerId, @projectId, @state,
        @currentStage, @progressPercent, @inputDigest, @approvalDigest,
        @resourceBudgetJson, @createdAt, @startedAt, @finishedAt, @error, @failureCategory
      )
    `);
    stmt.run({
      id: job.id,
      capabilityId: job.capabilityId,
      packId: job.packId,
      ownerId: job.ownerId,
      projectId: job.projectId ?? null,
      state: job.state,
      currentStage: job.currentStage,
      progressPercent: job.progressPercent,
      inputDigest: job.inputDigest,
      approvalDigest: job.approvalDigest ?? null,
      resourceBudgetJson: job.resourceBudgetJson,
      createdAt: job.createdAt,
      startedAt: job.startedAt ?? null,
      finishedAt: job.finishedAt ?? null,
      error: job.error ?? null,
      failureCategory: job.failureCategory ?? null
    });
  }

  public getJob(id: string): any {
    const stmt = this.db.prepare(`SELECT * FROM capability_jobs WHERE id = ?`);
    return stmt.get(id);
  }

  public saveApproval(approval: {
    approvalDigest: string;
    jobType: string;
    capabilityId: string;
    ownerId: string;
    projectId?: string;
    approvedBy: string;
    approvedAt: string;
    expiresAt: string;
    revoked: number;
    requestJson: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO capability_approvals (
        approval_digest, job_type, capability_id, owner_id, project_id,
        approved_by, approved_at, expires_at, revoked, request_json
      ) VALUES (
        @approvalDigest, @jobType, @capabilityId, @ownerId, @projectId,
        @approvedBy, @approvedAt, @expiresAt, @revoked, @requestJson
      )
    `);
    stmt.run({
      approvalDigest: approval.approvalDigest,
      jobType: approval.jobType,
      capabilityId: approval.capabilityId,
      ownerId: approval.ownerId,
      projectId: approval.projectId ?? null,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      expiresAt: approval.expiresAt,
      revoked: approval.revoked,
      requestJson: approval.requestJson
    });
  }

  public getApproval(digest: string): any {
    const stmt = this.db.prepare(`SELECT * FROM capability_approvals WHERE approval_digest = ?`);
    return stmt.get(digest);
  }

  public close(): void {
    this.db.close();
  }
}
