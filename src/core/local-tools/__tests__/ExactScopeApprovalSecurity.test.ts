import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectMutationStore } from '../../gaming/engine/ProjectMutationStore';
import { GameEngineError } from '../../gaming/engine/GameEngineTypes';

describe('RT-PLAT-005 — Exact-Scope Approval Security Suite', () => {
  let tempDir: string;
  let store: ProjectMutationStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exact-scope-approval-test-'));
    store = new ProjectMutationStore('godot', tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates deterministic inputDigest based on engine, projectRoot, and actions', () => {
    const proposal = store.createProposal({
      engine: 'godot',
      projectId: 'proj-1',
      title: 'Create Main Scene',
      description: 'Setup test scene',
      risk: 'low',
      actions: [
        {
          type: 'create_scene',
          targetPath: 'scenes/Main.tscn',
          params: { content: '[gd_scene load_steps=1 format=3]' },
        },
      ],
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.inputDigest).toBeDefined();
    expect(proposal.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(proposal.status).toBe('proposed');
  });

  it('requires approver identity and computes unique approvalDigest', () => {
    const proposal = store.createProposal({
      engine: 'godot',
      projectId: 'proj-1',
      title: 'Create Player Script',
      description: 'Setup player script',
      risk: 'low',
      actions: [
        {
          type: 'create_script',
          targetPath: 'scripts/Player.gd',
          params: { content: 'extends CharacterBody2D\n' },
        },
      ],
    });

    expect(() => store.approve(proposal.id, '')).toThrow(GameEngineError);

    const approved = store.approve(proposal.id, 'admin-user-42');
    expect(approved.status).toBe('approved');
    expect(approved.approvalDigest).toBeDefined();
    expect(approved.approvalDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects apply with mismatched or tampered approval digest', () => {
    const proposal = store.createProposal({
      engine: 'godot',
      projectId: 'proj-1',
      title: 'Update Resource',
      description: 'Modify test resource',
      risk: 'low',
      actions: [
        {
          type: 'modify_resource',
          targetPath: 'data/config.tres',
          params: { content: '[resource]' },
        },
      ],
    });

    store.approve(proposal.id, 'admin-user');
    const fakeDigest = '0'.repeat(64);

    expect(() => store.apply(proposal.id, fakeDigest)).toThrow(GameEngineError);
  });

  it('successfully applies valid approved proposal and enables atomic rollback', () => {
    const proposal = store.createProposal({
      engine: 'godot',
      projectId: 'proj-1',
      title: 'Write Level Scene',
      description: 'Create level scene',
      risk: 'low',
      actions: [
        {
          type: 'create_scene',
          targetPath: 'scenes/Level1.tscn',
          params: { content: '[gd_scene]\n[node name="Level1" type="Node2D"]' },
        },
      ],
    });

    const approved = store.approve(proposal.id, 'admin-user');
    const tx = store.apply(proposal.id, approved.approvalDigest!);

    expect(tx.id).toBeDefined();
    const writtenFile = path.join(tempDir, 'scenes/Level1.tscn');
    expect(fs.existsSync(writtenFile)).toBe(true);
    expect(fs.readFileSync(writtenFile, 'utf8')).toContain('Level1');

    // Rollback
    const rolledBackSuccess = store.rollback(tx.id);
    expect(rolledBackSuccess).toBe(true);
    expect(fs.existsSync(writtenFile)).toBe(false);
  });

  it('rejects path traversal attempts outside project root', () => {
    const proposal = store.createProposal({
      engine: 'godot',
      projectId: 'proj-1',
      title: 'Malicious Path Traversal',
      description: 'Attempt to escape root',
      risk: 'destructive',
      actions: [
        {
          type: 'create_script',
          targetPath: '../../outside-root-evil.sh',
          params: { content: 'rm -rf /' },
        },
      ],
    });

    const approved = store.approve(proposal.id, 'admin-user');
    expect(() => store.apply(proposal.id, approved.approvalDigest!)).toThrow();
  });
});
