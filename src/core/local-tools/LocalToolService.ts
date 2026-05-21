import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database/Database';
import { boolParam, ensureExpansionDatabase, jsonParam } from '../database/ExpansionDatabase';
import { ToolCatalogService } from '../tools/catalog/ToolCatalogService';

export interface LocalExecutableDetection {
  toolId?: string;
  toolSlug?: string;
  toolName: string;
  executableName: string;
  executablePath: string;
  detected: boolean;
  detectionMethod: 'path' | 'known_path' | 'manual';
  enabled: boolean;
  trustLevel: string;
  approvalPolicy: string;
}

export interface PlannedLocalToolRun {
  runId: string;
  status: 'planned';
  toolSlug?: string;
  executablePath?: string;
  commandTemplate: string;
  resolvedCommand: string[];
  cwd: string;
  riskLevel: string;
  requiresApproval: boolean;
}

export class LocalToolService {
  constructor(
    private readonly database?: Database,
    private readonly workspaceRoot: string = process.cwd()
  ) {}

  async detectAll(): Promise<{ detections: LocalExecutableDetection[] }> {
    const database = await ensureExpansionDatabase(this.database);
    await new ToolCatalogService(database).seedInitialCatalog();

    const result = await database.query(
      'SELECT id, slug, name, executable_names_json FROM tool_catalog WHERE executable_names_json IS NOT NULL ORDER BY name'
    );
    const detections: LocalExecutableDetection[] = [];

    for (const row of result.rows) {
      const executableNames = this.parseJson<string[]>(row.executable_names_json, []);
      for (const executableName of executableNames) {
        const paths = this.findExecutableCandidates(executableName, row.slug);
        for (const executablePath of paths) {
          const detection: LocalExecutableDetection = {
            toolId: row.id,
            toolSlug: row.slug,
            toolName: row.name,
            executableName,
            executablePath,
            detected: true,
            detectionMethod: this.isKnownPath(executablePath) ? 'known_path' : 'path',
            enabled: false,
            trustLevel: 'untrusted',
            approvalPolicy: 'ask_each_run'
          };
          await this.recordDetection(database, detection);
          detections.push(detection);
        }
      }
    }

    return { detections };
  }

  async listExecutables(): Promise<LocalExecutableDetection[]> {
    const database = await ensureExpansionDatabase(this.database);
    const rows = await database.query(
      `SELECT le.*, tc.slug AS tool_slug, tc.name AS tool_name
       FROM local_executables le
       LEFT JOIN tool_catalog tc ON tc.id = le.tool_id
       ORDER BY le.name, le.executable_path`
    );

    return rows.rows.map(row => ({
      toolId: row.tool_id || undefined,
      toolSlug: row.tool_slug || undefined,
      toolName: row.tool_name || row.name,
      executableName: row.name,
      executablePath: row.executable_path,
      detected: Boolean(row.detected),
      detectionMethod: row.detection_method || 'manual',
      enabled: Boolean(row.enabled),
      trustLevel: row.trust_level || 'untrusted',
      approvalPolicy: row.approval_policy || 'ask_each_run'
    }));
  }

  async registerManualExecutable(input: {
    name: string;
    executablePath: string;
    toolSlug?: string;
    enabled?: boolean;
    trustLevel?: string;
    approvalPolicy?: string;
  }): Promise<LocalExecutableDetection> {
    const database = await ensureExpansionDatabase(this.database);
    const tool = input.toolSlug
      ? (await database.query('SELECT id, slug, name FROM tool_catalog WHERE slug = ?', [input.toolSlug])).rows[0]
      : undefined;

    const detection: LocalExecutableDetection = {
      toolId: tool?.id,
      toolSlug: tool?.slug,
      toolName: tool?.name || input.name,
      executableName: input.name,
      executablePath: path.resolve(input.executablePath),
      detected: fs.existsSync(input.executablePath),
      detectionMethod: 'manual',
      enabled: input.enabled === true,
      trustLevel: input.trustLevel || 'private_user_tool',
      approvalPolicy: input.approvalPolicy || 'ask_each_run'
    };

    await this.recordDetection(database, detection);
    return detection;
  }

  async planRun(input: {
    toolSlug?: string;
    executablePath?: string;
    args?: string[];
    cwd?: string;
    riskLevel?: string;
    approvedByUser?: boolean;
  }): Promise<PlannedLocalToolRun> {
    const database = await ensureExpansionDatabase(this.database);
    const cwd = path.resolve(this.workspaceRoot, input.cwd || '.');
    if (!cwd.startsWith(this.workspaceRoot)) {
      throw new Error('Local tool runs must stay inside the workspace unless a broader path is explicitly approved in a later implementation step.');
    }

    const executable = await this.resolveExecutable(database, input.toolSlug, input.executablePath);
    const args = Array.isArray(input.args) ? input.args.map(String) : [];
    const riskLevel = input.riskLevel || 'low';
    const requiresApproval = riskLevel !== 'low' || executable.approval_policy === 'ask_each_run';
    const runId = uuidv4();

    await database.query(
      `INSERT INTO local_tool_runs (
        id, tool_id, executable_id, user_id, command_template, resolved_command_json, cwd,
        status, risk_level, approved_by_user, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        runId,
        executable.tool_id || null,
        executable.id || null,
        null,
        `${executable.executable_path} ${args.join(' ')}`.trim(),
        jsonParam([executable.executable_path, ...args]),
        cwd,
        'planned',
        riskLevel,
        boolParam(database, input.approvedByUser === true),
        jsonParam({ note: 'Phase 1 creates auditable planned runs only. Execution bridge is Phase 2.' })
      ]
    );

    return {
      runId,
      status: 'planned',
      toolSlug: input.toolSlug,
      executablePath: executable.executable_path,
      commandTemplate: `${executable.executable_path} ${args.join(' ')}`.trim(),
      resolvedCommand: [executable.executable_path, ...args],
      cwd,
      riskLevel,
      requiresApproval
    };
  }

  private async resolveExecutable(database: Database, toolSlug?: string, executablePath?: string): Promise<any> {
    if (executablePath) {
      return {
        id: null,
        tool_id: null,
        executable_path: path.resolve(executablePath),
        approval_policy: 'ask_each_run'
      };
    }

    if (!toolSlug) {
      throw new Error('toolSlug or executablePath is required');
    }

    const result = await database.query(
      `SELECT le.* FROM local_executables le
       INNER JOIN tool_catalog tc ON tc.id = le.tool_id
       WHERE tc.slug = ? AND le.enabled = ?
       ORDER BY le.updated_at DESC
       LIMIT 1`,
      [toolSlug, boolParam(database, true)]
    );

    if (!result.rows[0]) {
      throw new Error(`No enabled executable found for tool: ${toolSlug}`);
    }

    return result.rows[0];
  }

  private async recordDetection(database: Database, detection: LocalExecutableDetection): Promise<void> {
    const existing = await database.query(
      'SELECT id FROM local_executables WHERE name = ? AND executable_path = ? LIMIT 1',
      [detection.executableName, detection.executablePath]
    );
    const id = existing.rows[0]?.id || uuidv4();

    if (existing.rows[0]) {
      await database.query(
        `UPDATE local_executables SET
          tool_id = ?, detected = ?, detection_method = ?, last_checked_at = CURRENT_TIMESTAMP,
          metadata_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          detection.toolId || null,
          boolParam(database, detection.detected),
          detection.detectionMethod,
          jsonParam({ toolSlug: detection.toolSlug, toolName: detection.toolName }),
          id
        ]
      );
      return;
    }

    await database.query(
      `INSERT INTO local_executables (
        id, tool_id, name, executable_path, os, detected, detection_method, enabled,
        trust_level, approval_policy, last_checked_at, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        detection.toolId || null,
        detection.executableName,
        detection.executablePath,
        os.platform(),
        boolParam(database, detection.detected),
        detection.detectionMethod,
        boolParam(database, detection.enabled),
        detection.trustLevel,
        detection.approvalPolicy,
        jsonParam({ toolSlug: detection.toolSlug, toolName: detection.toolName })
      ]
    );
  }

  private findExecutableCandidates(executableName: string, toolSlug?: string): string[] {
    const candidates = new Set<string>();
    for (const dir of (process.env.PATH || '').split(path.delimiter)) {
      if (!dir) continue;
      const candidate = path.join(dir, executableName);
      if (fs.existsSync(candidate)) candidates.add(path.resolve(candidate));
      if (process.platform === 'win32' && !executableName.toLowerCase().endsWith('.exe')) {
        const exeCandidate = path.join(dir, `${executableName}.exe`);
        if (fs.existsSync(exeCandidate)) candidates.add(path.resolve(exeCandidate));
      }
    }

    for (const knownPath of this.knownExecutablePaths(executableName, toolSlug)) {
      if (fs.existsSync(knownPath)) candidates.add(path.resolve(knownPath));
    }

    return Array.from(candidates);
  }

  private knownExecutablePaths(executableName: string, toolSlug?: string): string[] {
    if (process.platform !== 'win32') return [];
    const programFiles = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean) as string[];
    const paths: string[] = [];

    if (toolSlug === 'aseprite') {
      for (const root of programFiles) {
        paths.push(path.join(root, 'Aseprite', 'Aseprite.exe'));
        paths.push(path.join(root, 'Steam', 'steamapps', 'common', 'Aseprite', 'Aseprite.exe'));
      }
    }

    if (toolSlug === 'blender') {
      for (const root of programFiles) paths.push(path.join(root, 'Blender Foundation', 'Blender', 'blender.exe'));
    }

    if (toolSlug === 'godot') {
      for (const root of programFiles) paths.push(path.join(root, 'Godot', 'godot.exe'));
    }

    paths.push(path.join(this.workspaceRoot, 'local-tools', toolSlug || executableName, executableName));
    if (!executableName.toLowerCase().endsWith('.exe')) {
      paths.push(path.join(this.workspaceRoot, 'local-tools', toolSlug || executableName, `${executableName}.exe`));
    }
    return paths;
  }

  private isKnownPath(executablePath: string): boolean {
    return executablePath.includes(`${path.sep}local-tools${path.sep}`)
      || executablePath.toLowerCase().includes('steamapps')
      || executablePath.toLowerCase().includes('program files');
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value as T;
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return fallback;
    }
  }
}
