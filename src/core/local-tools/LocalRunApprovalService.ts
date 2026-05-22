import { Database } from '../database/Database';
import { boolParam, ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';

export interface LocalRunSummary {
  id: string;
  status: string;
  commandTemplate: string;
  cwd: string;
  riskLevel: string;
  approvedByUser: boolean;
  executableEnabled?: boolean;
  executablePath?: string;
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
      `SELECT ltr.id, ltr.status, ltr.command_template, ltr.cwd, ltr.risk_level, ltr.approved_by_user,
        ltr.stdout_path, ltr.stderr_path, ltr.duration_ms, ltr.created_at, ltr.started_at, ltr.completed_at,
        le.enabled AS executable_enabled, le.executable_path AS executable_path
       FROM local_tool_runs ltr
       LEFT JOIN local_executables le ON le.id = ltr.executable_id
       ORDER BY ltr.created_at DESC
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

    const updated = (await database.query(
      `SELECT ltr.*, le.enabled AS executable_enabled, le.executable_path AS executable_path
       FROM local_tool_runs ltr
       LEFT JOIN local_executables le ON le.id = ltr.executable_id
       WHERE ltr.id = ?
       LIMIT 1`,
      [runId]
    )).rows[0];
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
      executableEnabled: row.executable_enabled === null || row.executable_enabled === undefined
        ? undefined
        : Boolean(row.executable_enabled),
      executablePath: row.executable_path || undefined,
      stdoutPath: row.stdout_path || undefined,
      stderrPath: row.stderr_path || undefined,
      durationMs: row.duration_ms === null || row.duration_ms === undefined ? undefined : Number(row.duration_ms),
      createdAt: row.created_at || undefined,
      startedAt: row.started_at || undefined,
      completedAt: row.completed_at || undefined
    };
  }
}
