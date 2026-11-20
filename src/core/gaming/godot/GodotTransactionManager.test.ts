import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GodotMcpXAdapter } from './GodotMcpXAdapter';
import { GodotTransactionManager } from './GodotTransactionManager';
import { GodotSceneMutator } from './GodotSceneMutator';
import { EngineMutationAction } from '../engine/GameEngineTypes';
import { proposalDigest } from '../engine/EngineProposalIntegrity';
import { EngineMutationProposal } from '../engine/GameEngineTypes';

describe('G00 Godot proposal integrity and capability boundaries (no native execution)', () => {
  let root: string;
  let manager: GodotTransactionManager;
  const action = (): EngineMutationAction => ({ type: 'create_scene', targetPath: 'New.tscn', params: { rootNodeName: 'Approved', nested: { value: 1 } } });
  const propose = (actions = [action()]) => manager.createProposal({ projectId: 'game', title: 'Fixture', description: '', actions, requesterId: 'owner', tenantId: 'tenant' });
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-g00-'));
    manager = new GodotTransactionManager(root);
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('binds nested values and action order while ignoring object key order', () => {
    const digest = (actions: EngineMutationAction[]) => GodotTransactionManager.computeInputDigest('game', actions);
    const original = action();
    expect(digest([original])).toBe(digest([{ params: { nested: { value: 1 }, rootNodeName: 'Approved' }, targetPath: 'New.tscn', type: 'create_scene' }]));
    expect(digest([original])).not.toBe(digest([{ ...original, params: { ...original.params, nested: { value: 2 } } }]));
    const second = { ...original, targetPath: 'Other.tscn' };
    expect(digest([original, second])).not.toBe(digest([second, original]));
  });

  it('rejects malformed proposal scope and keeps approvals specific to one proposal', async () => {
    const draft = { projectId: 'game', title: '', description: '', actions: [action()] };
    expect(() => manager.createProposal({ ...draft, risk: 'unknown' as any })).toThrow('Invalid proposal');
    expect(() => manager.createProposal({ ...draft, projectId: {} as any })).toThrow('Invalid proposal');
    const one = manager.approveProposal(propose().id, 'reviewer');
    const two = manager.approveProposal(propose().id, 'reviewer');
    const applier = jest.fn();
    await expect(manager.executeTransaction(two.id, one.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('APPROVAL_DIGEST_MISMATCH');
    expect(applier).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -Infinity, -0, undefined, new Date(), new Map(), () => 1])('rejects non-JSON nested data (%p)', value => {
    const original = action();
    original.params.nested = value;
    expect(() => propose([original])).toThrow('CANONICAL_');
  });

  it('rejects cycles, sparse arrays and accessors without evaluating them', () => {
    const circular: any = {}; circular.self = circular;
    const getter = jest.fn();
    for (const value of [circular, new Array(2), Object.defineProperty({}, 'value', { get: getter, enumerable: true })]) {
      expect(() => propose([{ ...action(), params: { value } }])).toThrow('CANONICAL_');
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(['id', 'projectId', 'requesterId', 'tenantId', 'environment', 'capabilityVersion', 'title', 'description', 'risk', 'expiresAt', 'createdAt'] as const)('binds proposal field %s', field => {
    const proposal = propose();
    const changed = { ...proposal, [field]: `${proposal[field]}-changed` };
    expect(proposalDigest(root, changed)).not.toBe(proposal.inputDigest);
  });

  it('binds root, expected outputs and exact input byte hashes', () => {
    fs.writeFileSync(path.join(root, 'New.tscn'), Buffer.from('\ufefforiginal\r\n'));
    const proposal = propose();
    expect(proposalDigest(path.join(root, 'other'), proposal)).not.toBe(proposal.inputDigest);
    expect(proposalDigest(root, { ...proposal, expectedOutputs: ['Other.tscn'] })).not.toBe(proposal.inputDigest);
    expect(proposalDigest(root, { ...proposal, inputFileHashes: { 'New.tscn': null } })).not.toBe(proposal.inputDigest);
  });

  it('keeps caller mutations out of server-owned proposal, approval and rollback state', async () => {
    const draftAction = action();
    const proposal = propose([draftAction]);
    draftAction.params.rootNodeName = 'DraftTampered';
    proposal.actions[0].params.rootNodeName = 'Tampered';
    proposal.status = 'approved'; proposal.approverId = 'intruder'; proposal.approvalDigest = 'forged';
    const applier = jest.fn(GodotSceneMutator.applyAction);
    await expect(manager.executeTransaction(proposal.id, 'forged', applier, { callerId: 'intruder' })).rejects.toThrow('APPROVAL_REQUIRED');
    const approved = manager.approveProposal(proposal.id, 'reviewer');
    approved.actions[0].params.rootNodeName = 'AlsoTampered';
    manager.getProposal(proposal.id).actions[0].params.rootNodeName = 'GetterTampered';
    const tx = await manager.executeTransaction(proposal.id, approved.approvalDigest!, applier, { callerId: 'reviewer', tenantId: 'tenant' });
    expect(fs.readFileSync(path.join(root, 'New.tscn'), 'utf8')).toContain('Approved');
    tx.snapshots[0].previousContent = 'Forged rollback';
    manager.getTransaction(tx.id)!.snapshots[0].previousContent = 'Forged getter';
    expect(manager.rollbackTransaction(tx.id)).toBe(true);
    expect(fs.existsSync(path.join(root, 'New.tscn'))).toBe(false);
  });

  it('invalidates approval if stored nested parameters change before apply', async () => {
    const approved = manager.approveProposal(propose().id, 'reviewer');
    // Simulate internal state corruption; public getters return detached copies.
    const records = (manager as unknown as { proposals: Map<string, EngineMutationProposal> }).proposals;
    records.get(approved.id)!.actions[0].params.nested.value = 999;
    const applier = jest.fn();
    await expect(manager.executeTransaction(approved.id, approved.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('scope changed');
    expect(applier).not.toHaveBeenCalled();
  });

  it.each(['changed', 'created', 'deleted'])('rejects %s inputs before calling any writer', async kind => {
    const target = path.join(root, 'New.tscn');
    if (kind !== 'created') fs.writeFileSync(target, 'before');
    const proposal = propose();
    const approved = manager.approveProposal(proposal.id, 'reviewer');
    if (kind === 'deleted') fs.unlinkSync(target); else fs.writeFileSync(target, 'external edit');
    const applier = jest.fn();
    await expect(manager.executeTransaction(proposal.id, approved.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('modified since proposal');
    expect(applier).not.toHaveBeenCalled();
  });

  it('rejects expiry at apply, identity/tenant mismatch and duplicate in-flight apply', async () => {
    const proposal = propose();
    const approved = manager.approveProposal(proposal.id, 'reviewer');
    const applier = jest.fn();
    for (const options of [{}, { callerId: 'intruder' }, { callerId: 'reviewer', tenantId: 'other' }]) {
      await expect(manager.executeTransaction(proposal.id, approved.approvalDigest!, applier, options)).rejects.toThrow('APPROVAL_REQUIRED');
    }
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(approved.expiresAt));
    await expect(manager.executeTransaction(proposal.id, approved.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('expired');
    now.mockRestore();
    let finish!: () => void;
    const applying = manager.executeTransaction(proposal.id, approved.approvalDigest!, () => new Promise<void>(resolve => { finish = resolve; }), { callerId: 'reviewer' });
    await expect(manager.executeTransaction(proposal.id, approved.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('already applying');
    finish(); await applying;
    expect(applier).not.toHaveBeenCalled();
  });

  it.each(['remove_node', 'rename_node', 'reparent_node', 'attach_script', 'disconnect_signal', 'save_scene', 'custom'] as const)('rejects unsupported %s before the first write or directory creation', async type => {
    const adapter = new GodotMcpXAdapter();
    await adapter.connect({ engine: 'godot', projectRoot: root });
    const proposal = await adapter.proposeMutation({ engine: 'godot', projectId: 'game', title: '', description: '', risk: 'low', actions: [action(), { type, targetPath: 'nested/Main.tscn', params: {} }] });
    const approved = await adapter.approveMutation(proposal.id, 'reviewer');
    await expect(adapter.applyMutation(proposal.id, approved.approvalDigest!, { callerId: 'reviewer' })).rejects.toThrow('does not support action type');
    expect(fs.readdirSync(root)).toEqual([]);
    await expect(GodotSceneMutator.applyAction({ type, targetPath: 'nested/Main.tscn', params: {} }, root)).rejects.toThrow();
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('rejects binary content even when disguised with a text extension', async () => {
    fs.writeFileSync(path.join(root, 'New.tscn'), Buffer.from([0xff, 0x00, 0xfe]));
    const approved = manager.approveProposal(propose().id, 'reviewer');
    const applier = jest.fn();
    await expect(manager.executeTransaction(approved.id, approved.approvalDigest!, applier, { callerId: 'reviewer' })).rejects.toThrow('Binary content');
    expect(applier).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(root, 'New.tscn'))).toEqual(Buffer.from([0xff, 0x00, 0xfe]));
  });

  it('restores exact original UTF-8 bytes on failure, including BOM and CRLF', async () => {
    const bytes = Buffer.from('\ufeff[gd_scene format=3]\r\n');
    fs.writeFileSync(path.join(root, 'New.tscn'), bytes);
    const approved = manager.approveProposal(propose([action(), { ...action(), targetPath: 'Second.tscn' }]).id, 'reviewer');
    let calls = 0;
    await expect(manager.executeTransaction(approved.id, approved.approvalDigest!, async action => {
      if (++calls === 2) throw new Error('fixture failure');
      fs.writeFileSync(path.join(root, action.targetPath), 'changed');
    }, { callerId: 'reviewer' })).rejects.toThrow('rolled back');
    expect(fs.readFileSync(path.join(root, 'New.tscn'))).toEqual(bytes);
  });
});
