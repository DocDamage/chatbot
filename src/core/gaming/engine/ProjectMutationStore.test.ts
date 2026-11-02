import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EngineMutationAction } from './GameEngineTypes';
import { ProjectMutationStore } from './ProjectMutationStore';

describe('ProjectMutationStore', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-mutation-store-'));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function proposal(store: ProjectMutationStore, actions: EngineMutationAction[]) {
    return store.createProposal({
      engine: 'unity', projectId: 'fixture', title: 'Fixture', description: '', risk: 'low', actions
    });
  }

  it('requires explicit identity-bound approval and applies and rolls back exact files', () => {
    const store = new ProjectMutationStore('unity', root);
    fs.writeFileSync(path.join(root, 'existing.txt'), 'before');
    const pending = proposal(store, [
      { type: 'update_script', targetPath: 'existing.txt', params: { content: 'after' } },
      { type: 'create_script', targetPath: 'new.txt', params: { content: 'new' } }
    ]);
    expect(pending.approvalDigest).toBeUndefined();
    expect(() => store.apply(pending.id, pending.inputDigest, { callerId: 'reviewer' })).toThrow('APPROVAL_REQUIRED');
    expect(() => store.approve(pending.id, ' ')).toThrow('approver identity');

    const approved = store.approve(pending.id, 'reviewer');
    expect(approved.approvalDigest).not.toBe(approved.inputDigest);
    expect(() => store.apply(pending.id, 'wrong', { callerId: 'reviewer' })).toThrow('APPROVAL_DIGEST_MISMATCH');

    // Caller identity enforcement
    expect(() => store.apply(pending.id, approved.approvalDigest!)).toThrow('Caller identity is required');
    expect(() => store.apply(pending.id, approved.approvalDigest!, { callerId: 'intruder' })).toThrow('does not match approver identity');

    const transaction = store.apply(pending.id, approved.approvalDigest!, { callerId: 'reviewer' });
    expect(fs.readFileSync(path.join(root, 'existing.txt'), 'utf8')).toBe('after');
    expect(fs.readFileSync(path.join(root, 'new.txt'), 'utf8')).toBe('new');
    expect(store.rollback(transaction.id)).toBe(true);
    expect(fs.readFileSync(path.join(root, 'existing.txt'), 'utf8')).toBe('before');
    expect(fs.existsSync(path.join(root, 'new.txt'))).toBe(false);
    expect(store.rollback(transaction.id)).toBe(false);
  });

  it('prevalidates the whole action set so unsupported or malformed work cannot partially apply', () => {
    const store = new ProjectMutationStore('unreal', root);
    const unsupported = proposal(store, [
      { type: 'create_script', targetPath: 'first.cpp', params: { content: 'first' } },
      { type: 'add_node', targetPath: 'second.cpp', params: { content: 'second' } }
    ]);
    const approvedUnsupported = store.approve(unsupported.id, 'reviewer');
    expect(() => store.apply(unsupported.id, approvedUnsupported.approvalDigest!, { callerId: 'reviewer' })).toThrow('does not support action type');
    expect(fs.existsSync(path.join(root, 'first.cpp'))).toBe(false);

    const missingContent = proposal(store, [{ type: 'create_script', targetPath: 'missing.cpp', params: {} }]);
    const approvedMissing = store.approve(missingContent.id, 'reviewer');
    expect(() => store.apply(missingContent.id, approvedMissing.approvalDigest!, { callerId: 'reviewer' })).toThrow('requires params.content');
    expect(fs.existsSync(path.join(root, 'missing.cpp'))).toBe(false);
  });

  it('restores earlier writes when a later filesystem operation fails', () => {
    const store = new ProjectMutationStore('unity', root);
    fs.writeFileSync(path.join(root, 'existing.txt'), 'before');
    fs.writeFileSync(path.join(root, 'blocked-parent'), 'not a directory');
    const pending = proposal(store, [
      { type: 'update_script', targetPath: 'existing.txt', params: { content: 'after' } },
      { type: 'create_script', targetPath: 'blocked-parent/child.txt', params: { content: 'never written' } }
    ]);
    const approved = store.approve(pending.id, 'reviewer');
    expect(() => store.apply(pending.id, approved.approvalDigest!, { callerId: 'reviewer' })).toThrow('failed and was rolled back');
    expect(fs.readFileSync(path.join(root, 'existing.txt'), 'utf8')).toBe('before');
  });

  it('snapshots repeated targets once and supports approved file deletion', () => {
    const store = new ProjectMutationStore('unreal', root);
    fs.writeFileSync(path.join(root, 'repeat.txt'), 'original');
    fs.writeFileSync(path.join(root, 'delete.txt'), 'remove me');
    const pending = proposal(store, [
      { type: 'update_script', targetPath: 'repeat.txt', params: { content: 'first' } },
      { type: 'update_script', targetPath: 'repeat.txt', params: { content: 'second' } },
      { type: 'delete_scene', targetPath: 'delete.txt', params: {} },
      { type: 'remove_node', targetPath: 'already-absent.txt', params: {} }
    ]);
    const approved = store.approve(pending.id, 'reviewer');
    const transaction = store.apply(pending.id, approved.approvalDigest!, { callerId: 'reviewer' });
    expect(transaction.snapshots).toHaveLength(3);
    expect(fs.readFileSync(path.join(root, 'repeat.txt'), 'utf8')).toBe('second');
    expect(fs.existsSync(path.join(root, 'delete.txt'))).toBe(false);
    expect(store.rollback(transaction.id)).toBe(true);
    expect(fs.readFileSync(path.join(root, 'repeat.txt'), 'utf8')).toBe('original');
    expect(fs.readFileSync(path.join(root, 'delete.txt'), 'utf8')).toBe('remove me');
  });

  it('rejects missing, expired, or already-transitioned proposals', () => {
    const store = new ProjectMutationStore('unity', root);
    expect(() => store.approve('missing', 'reviewer')).toThrow('not found');
    expect(() => store.apply('missing', 'digest', { callerId: 'reviewer' })).toThrow('not found');
    expect(store.rollback('missing')).toBe(false);

    const expired = proposal(store, []);
    expired.expiresAt = new Date(0).toISOString();
    expect(() => store.approve(expired.id, 'reviewer')).toThrow('expired');

    const pending = proposal(store, []);
    const approved = store.approve(pending.id, 'reviewer');
    expect(() => store.approve(pending.id, 'another-reviewer')).toThrow('status is approved');
    store.apply(pending.id, approved.approvalDigest!, { callerId: 'reviewer' });
    expect(() => store.apply(pending.id, approved.approvalDigest!, { callerId: 'reviewer' })).toThrow('status is applied');
  });
});
