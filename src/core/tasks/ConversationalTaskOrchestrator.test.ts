import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConversationalTaskOrchestrator } from './ConversationalTaskOrchestrator';

describe('ConversationalTaskOrchestrator', () => {
  let workspaceRoot: string;
  let orchestrator: ConversationalTaskOrchestrator;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-task-'));
    orchestrator = new ConversationalTaskOrchestrator(workspaceRoot);
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('qualifies a vague game request over multiple turns and builds a playable browser game', () => {
    const first = orchestrator.handle('game-session', 'make a game for me', 'history');
    expect(first?.task).toEqual(expect.objectContaining({ kind: 'game', status: 'needs_input', awaiting: 'game_concept' }));

    const second = orchestrator.handle('game-session', 'a space shooter protecting a moon base', 'history');
    expect(second?.task.awaiting).toBe('game_platform');

    const completed = orchestrator.handle('game-session', 'browser', 'history');
    expect(completed?.task.status).toBe('completed');
    expect(completed?.artifacts).toHaveLength(2);

    const gamePath = path.join(workspaceRoot, 'data', 'chat-task-artifacts', 'game-session', completed!.artifacts![0].name);
    expect(fs.readFileSync(gamePath, 'utf8')).toContain('<canvas id="game"');
  });

  it('builds a Godot starter project when that platform is selected', () => {
    const completed = orchestrator.handle('godot-session', 'build a Godot space shooter game', 'plan');
    expect(completed?.task.status).toBe('completed');
    expect(completed?.artifacts?.map(artifact => artifact.name)).toEqual(['project.godot', 'main.tscn', 'main.gd']);
    expect(fs.existsSync(path.join(workspaceRoot, 'data', 'chat-task-artifacts', 'godot-session', 'main.gd'))).toBe(true);
  });

  it('builds a pie chart and preserves clean labels from a direct request', () => {
    const completed = orchestrator.handle('chart-session', 'make a pie chart for Rent: 1200, Food: 450, Travel: 200', 'music');
    expect(completed?.task.status).toBe('completed');
    expect(completed?.artifacts).toHaveLength(2);

    const csvPath = path.join(workspaceRoot, 'data', 'chat-task-artifacts', 'chart-session', completed!.artifacts![1].name);
    expect(fs.readFileSync(csvPath, 'utf8')).toContain('Rent,1200');
  });

  it('asks for spreadsheet details and then creates the requested columns', () => {
    const first = orchestrator.handle('sheet-session', 'create a spreadsheet', 'ask');
    expect(first?.task.awaiting).toBe('spreadsheet_data');

    const completed = orchestrator.handle('sheet-session', 'columns are Task, Owner, Status', 'ask');
    expect(completed?.task.status).toBe('completed');
    const csvPath = path.join(workspaceRoot, 'data', 'chat-task-artifacts', 'sheet-session', completed!.artifacts![0].name);
    expect(fs.readFileSync(csvPath, 'utf8')).toBe('Task,Owner,Status\n,,\n');
  });

  it('can cancel a pending task', () => {
    orchestrator.handle('cancel-session', 'make a chart', 'ask');
    const result = orchestrator.handle('cancel-session', 'never mind', 'ask');
    expect(result?.task.status).toBe('cancelled');
    expect(orchestrator.getPendingTask('cancel-session')).toBeUndefined();
  });
});
