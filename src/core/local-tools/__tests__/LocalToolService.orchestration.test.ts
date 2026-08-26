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

  it('runs detectAll to populate catalog and discover system executables', async () => {
    const result = await service.detectAll();
    expect(Array.isArray(result.detections)).toBe(true);
  });

  it('registers manual executables and lists detected local tools', async () => {
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

    const list = await service.listExecutables();
    expect(list.some(e => e.executableName === 'node-test-runner')).toBe(true);
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
      cwd: tempWorkspace,
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
      cwd: tempWorkspace,
      approvedByUser: true
    });

    expect(executed.status).toBe('completed');
    expect(executed.stdout).toContain('direct execution');
  });

  it('rejects execution for non-existent planned runs or wrong status', async () => {
    await expect(service.executePlannedRun('fake-run-id', true)).rejects.toThrow('Local tool run not found');
  });
});
