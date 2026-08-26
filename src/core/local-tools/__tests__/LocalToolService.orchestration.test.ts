import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../../database/Database';
import { ensureExpansionDatabase } from '../../database/ExpansionDatabase';
import { LocalToolService } from '../LocalToolService';
import { LocalRunApprovalService } from '../LocalRunApprovalService';

describe('RT-PLAT-005 / RT-TOOL-003: LocalToolService Orchestration and Execution Governance Suite', () => {
  let tempWorkspace: string;
  let database: Database;
  let service: LocalToolService;
  let approvalService: LocalRunApprovalService;

  beforeEach(async () => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'local-tool-svc-test-'));
    database = new Database({
      type: 'sqlite',
      filePath: path.join(tempWorkspace, 'test.db')
    });
    await database.initialize();
    await ensureExpansionDatabase(database);

    service = new LocalToolService(database, tempWorkspace);
    approvalService = new LocalRunApprovalService(database);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('runs detectAll to populate catalog and discover system executables, and handles updates', async () => {
    const result1 = await service.detectAll();
    expect(Array.isArray(result1.detections)).toBe(true);

    // Second run tests recordDetection update path
    const result2 = await service.detectAll();
    expect(Array.isArray(result2.detections)).toBe(true);
  });

  it('registers manual executables and lists detected local tools with fallback defaults', async () => {
    const manual = await service.registerManualExecutable({
      name: 'node-test-runner',
      executablePath: process.execPath,
      enabled: true,
      trustLevel: 'trusted_local',
      approvalPolicy: 'ask_high_risk_only'
    });

    expect(manual.executableName).toBe('node-test-runner');
    expect(manual.detected).toBe(true);
    expect(manual.enabled).toBe(true);

    // Insert an executable with manual metadata to test listExecutables
    await database.query(`
      INSERT INTO local_executables (id, name, executable_path, os, detected, detection_method, enabled, trust_level, approval_policy)
      VALUES ('custom-exe', 'custom-exe', 'path/to/custom', 'win32', 1, 'manual', 1, 'untrusted', 'ask_each_run')
    `);

    const list = await service.listExecutables();
    expect(list.some(e => e.executableName === 'node-test-runner')).toBe(true);
    expect(list.some(e => e.executableName === 'custom-exe')).toBe(true);
  });

  it('plans a run and enforces approval requirement based on policy and risk level', async () => {
    await service.registerManualExecutable({
      name: 'node-eval',
      executablePath: process.execPath,
      enabled: true,
      trustLevel: 'trusted',
      approvalPolicy: 'ask_each_run'
    });

    // 1. Plan run with ask_each_run policy
    const planned = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("planned");'],
      cwd: '.',
      riskLevel: 'medium'
    });

    expect(planned.status).toBe('planned');
    expect(planned.requiresApproval).toBe(true);
    expect(planned.resolvedCommand).toEqual([process.execPath, '-e', 'console.log("planned");']);

    // 2. Executing without approval when required throws error
    await expect(service.executePlannedRun(planned.runId, false)).rejects.toThrow('requires explicit user approval');

    // 3. Executing with explicit user approval succeeds
    const executed = await service.executePlannedRun(planned.runId, true);
    expect(executed.status).toBe('completed');
    expect(executed.approvedByUser).toBe(true);
    expect(executed.stdout).toContain('planned');
  });

  it('runs planAndExecute with direct approval', async () => {
    const executed = await service.planAndExecute({
      executablePath: process.execPath,
      args: ['-e', 'console.log("direct execution");'],
      cwd: '.',
      approvedByUser: true
    });

    expect(executed.status).toBe('completed');
    expect(executed.stdout).toContain('direct execution');
  });

  it('rejects execution for non-existent planned runs or wrong status', async () => {
    await expect(service.executePlannedRun('fake-run-id', true)).rejects.toThrow('Local tool run not found');

    const planned = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("status test");']
    });

    // Mutate status to running
    await database.query("UPDATE local_tool_runs SET status = 'running' WHERE id = ?", [planned.runId]);
    await expect(service.executePlannedRun(planned.runId, true)).rejects.toThrow('Local tool run cannot be executed from status');
  });

  it('rejects forbidden arguments and paths escaping workspace', async () => {
    await expect(service.planRun({
      executablePath: process.execPath,
      cwd: '../../outside',
      args: []
    })).rejects.toThrow('must stay inside the workspace');

    // Disallowed argument for tool
    await expect(service.planRun({
      executablePath: process.execPath,
      toolSlug: 'aseprite',
      args: ['--forbidden-flag']
    })).rejects.toThrow('Flag is not allowed for aseprite');
  });

  it('enforces executable resolution rules and disabled executable gates', async () => {
    // Service constructed with default workspaceRoot
    const defaultSvc = new LocalToolService(database);
    expect(defaultSvc).toBeDefined();

    // Missing both toolSlug and executablePath
    await expect(service.planRun({})).rejects.toThrow('toolSlug or executablePath is required');

    // Tool without enabled executable
    await expect(service.planRun({ toolSlug: 'unknown-tool-slug' })).rejects.toThrow('No enabled executable found');

    // Seed tool catalog and resolve registered toolSlug
    await service.detectAll();
    await service.registerManualExecutable({
      name: 'aseprite',
      executablePath: process.execPath,
      toolSlug: 'aseprite',
      enabled: true
    });
    const plannedTool = await service.planRun({ toolSlug: 'aseprite', args: ['-b'] });
    expect(plannedTool.toolSlug).toBe('aseprite');

    // Disabled executable execution requires explicit approval
    const disabledReg = await service.registerManualExecutable({
      name: 'node-disabled',
      executablePath: process.execPath,
      enabled: false,
      approvalPolicy: 'ask_high_risk_only'
    });
    expect(disabledReg.enabled).toBe(false);

    // Plan run with node, then mark run as approved in DB, but disable executable in DB:
    const plannedDisabled = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("disabled run");']
    });
    const disabledExe = await service.registerManualExecutable({
      name: 'node-disabled-2',
      executablePath: process.execPath,
      enabled: false
    });
    const dbRow = (await database.query("SELECT id FROM local_executables WHERE name = 'node-disabled-2'")).rows[0];
    await database.query("UPDATE local_tool_runs SET executable_id = ?, approved_by_user = 1 WHERE id = ?", [dbRow.id, plannedDisabled.runId]);
    await expect(service.executePlannedRun(plannedDisabled.runId, false)).rejects.toThrow('Local executable is not enabled');

    // Executing disabled executable with explicit runtime approval succeeds
    process.env.LOCAL_TOOL_TIMEOUT_MS = '10000';
    const executedDisabled = await service.executePlannedRun(plannedDisabled.runId, true);
    expect(executedDisabled.status).toBe('completed');
    delete process.env.LOCAL_TOOL_TIMEOUT_MS;

    // Empty executable path in planned command
    await database.query("INSERT INTO local_tool_runs (id, status, command_template, resolved_command_json, cwd) VALUES ('no-exe', 'planned', 'empty', '[\"\"]', '.')");
    await expect(service.executePlannedRun('no-exe', true)).rejects.toThrow('Planned run does not contain an executable path');

    // Low risk policy branch without approval needed
    await service.registerManualExecutable({
      name: 'node-high-risk-only',
      executablePath: process.execPath,
      enabled: true,
      approvalPolicy: 'ask_high_risk_only'
    });
    const lowRiskPlanned = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("low risk");'],
      riskLevel: 'low'
    });
    const exeRow = (await database.query("SELECT id FROM local_executables WHERE name = 'node-high-risk-only'")).rows[0];
    await database.query("UPDATE local_tool_runs SET executable_id = ? WHERE id = ?", [exeRow.id, lowRiskPlanned.runId]);
    const lowRiskExecuted = await service.executePlannedRun(lowRiskPlanned.runId);
    expect(lowRiskExecuted.status).toBe('completed');

    // Test parseJson and candidate resolution utilities
    expect((service as any).parseJson(null, 'default')).toBe('default');
    expect((service as any).parseJson('{ invalid json', 'default')).toBe('default');
    expect((service as any).parseJson({ already: 'object' }, 'default')).toEqual({ already: 'object' });
    expect((service as any).isKnownPath('C:\\Program Files\\Blender\\blender.exe')).toBe(true);
    expect((service as any).isKnownPath('C:\\steamapps\\common\\Aseprite\\Aseprite.exe')).toBe(true);
    (service as any).findExecutableCandidates('blender', 'blender');
    (service as any).findExecutableCandidates('godot', 'godot');
  });

  it('exercises LocalRunApprovalService listing and approvals', async () => {
    const planned = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("to approve");'],
      riskLevel: 'high'
    });

    // Test mapRow with null fields and defined values
    const mapped = (approvalService as any).mapRow({
      id: 'run-null',
      status: 'planned',
      command_template: 'test',
      cwd: '.',
      risk_level: 'low',
      approved_by_user: 0,
      executable_enabled: null,
      executable_path: null,
      stdout_path: null,
      stderr_path: null,
      duration_ms: null,
      created_at: null,
      started_at: null,
      completed_at: null
    });
    expect(mapped.executableEnabled).toBeUndefined();
    expect(mapped.durationMs).toBeUndefined();

    const mappedDefined = (approvalService as any).mapRow({
      id: 'run-def',
      status: 'completed',
      command_template: 'test',
      cwd: '.',
      risk_level: 'low',
      approved_by_user: 1,
      executable_enabled: 1,
      executable_path: 'path/to/exe',
      stdout_path: 'stdout.log',
      stderr_path: 'stderr.log',
      duration_ms: 120,
      created_at: '2026-08-26T00:00:00Z',
      started_at: '2026-08-26T00:00:01Z',
      completed_at: '2026-08-26T00:00:02Z'
    });
    expect(mappedDefined.executableEnabled).toBe(true);
    expect(mappedDefined.durationMs).toBe(120);

    // List runs with default limit and with explicit limit
    const runsDefault = await approvalService.listRuns();
    expect(runsDefault.length).toBeGreaterThan(0);
    const runs = await approvalService.listRuns(50);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].id).toBe(planned.runId);

    // Approve run with and without note
    const planned2 = await service.planRun({
      executablePath: process.execPath,
      args: ['-e', 'console.log("no note");']
    });
    const approvedWithoutNote = await approvalService.approveRun(planned2.runId);
    expect(approvedWithoutNote.approvedByUser).toBe(true);

    // Approve run with note
    const approved = await approvalService.approveRun(planned.runId, 'Reviewed and verified safe');
    expect(approved.id).toBe(planned.runId);
    expect(approved.approvedByUser).toBe(true);

    // Execute already approved run without re-passing approval flag
    const executed = await service.executePlannedRun(planned.runId, false);
    expect(executed.status).toBe('completed');
    expect(executed.stdout).toContain('to approve');

    // Trying to approve an already completed run throws error
    await expect(approvalService.approveRun(planned.runId)).rejects.toThrow('Only planned or failed local tool runs can be approved');

    // Approving non-existent run throws error
    await expect(approvalService.approveRun('non-existent-run-id')).rejects.toThrow('Local tool run not found');
  });
});
