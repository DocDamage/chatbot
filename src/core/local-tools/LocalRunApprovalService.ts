import { Database } from '../database/Database';
import { boolParam, ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';

export interface LocalRunSummary {
  id: string;
  status: string;
  commandTemplate: string;
  cwd: string;
  riskLevel: string;
  approvedByUser: boolean;
  stdoutPath?: string;
  stderrPath?: string;
  durationMs?: number;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export class LocalRunApprovalService {
  constructor(private readonly database?: Database) {}

  async listRuns(limit = 25): Promise<LocalRunSummary[]> {
    const database = await ensureExpansionDatabase(this.database);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await database.query(
      `SELECT id, status, command_template, cwd, risk_level, approved_by_user,
        stdout_path, stderr_path, duration_ms, created_at, started_at, completed_at
       FROM local_tool_runs
       ORDER BY created_at DESC
       LIMIT ?`,
      [safeLimit]
    );
    return result.rows.map(row => this.mapRow(row));
  }

  async approveRun(runId: string, approvalNote?: string): Promise<LocalRunSummary> {
    const database = await ensureExpansionDatabase(this.database);
    const existing = (await database.query('SELECT * FROM local_tool_runs WHERE id = ? LIMIT 1', [runId])).rows[0];
    if (!existing) {
      throw new Error(`Local tool run not found: ${runId}`);
    }
    if (existing.status !== 'planned' && existing.status !== 'failed') {
      throw new Error(`Only planned or failed local tool runs can be approved. Current status: ${existing.status}`);
    }

    await database.query(
      `UPDATE local_tool_runs
       SET approved_by_user = ?, metadata_json = ?
       WHERE id = ?`,
      [
        boolParam(database, true),
        jsonParam({ approvedAt: new Date().toISOString(), approvalNote: approvalNote || null }),
        runId
      ]
    );

    const updated = (await database.query('SELECT * FROM local_tool_runs WHERE id = ? LIMIT 1', [runId])).rows[0];
    return this.mapRow(updated);
  }

  private mapRow(row: any): LocalRunSummary {
    return {
      id: row.id,
      status: row.status,
      commandTemplate: row.command_template,
      cwd: row.cwd,
      riskLevel: row.risk_level,
      approvedByUser: Boolean(row.approved_by_user),
      stdoutPath: row.stdout_path || undefined,
      stderrPath: row.stderr_path || undefined,
      durationMs: row.duration_ms === null || row.duration_ms === undefined ? undefined : Number(row.duration_ms),
      createdAt: row.created_at || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined
    };
  }
}
