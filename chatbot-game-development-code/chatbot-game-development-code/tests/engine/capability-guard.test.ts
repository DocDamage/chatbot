import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeApply, capabilityIssues, classifyTarget, type ApprovalRecord, type GuardContext } from '../../src/engine/capability-guard.js';
import { sealProposal, sha256, type ProposalScope } from '../../src/engine/proposal-integrity.js';

function fixture(engine: ProposalScope['engine'] = 'godot', action = 'update_script', targetPath = 'Player.gd') {
  const proposal = sealProposal('proposal-1', { schemaVersion: 1, runId: 'run-1', projectId: 'p1', canonicalProjectRoot: '/projects/p1',
    requesterId: 'alice', tenantId: 'team', environment: 'local', engine, exactEngineVersion: 'exact-version',
    profileDigest: sha256('profile'), adapterVersion: '2', executablePath: '/tools/editor', executableSha256: sha256('exe'),
    actions: [{ type: action, targetPath, params: { content: 'real source\n' } }], inputFileHashes: { [targetPath]: null },
    expectedOutputs: [targetPath], verificationPlanDigest: sha256('checks'), expiresAtMs: 10_000 });
  const context: GuardContext = { deploymentMode: 'local-trusted', workMode: 'implement', principal: { userId: 'alice', tenantId: 'team' },
    projectId: 'p1', canonicalProjectRoot: '/projects/p1', environment: 'local', nowMs: 100,
    profile: { engine, exactEngineVersion: 'exact-version', profileDigest: sha256('profile'), adapterVersion: '2',
      executablePath: '/tools/editor', executableSha256: sha256('exe'),
      capabilities: [{ action: 'update_script', targetKind: 'source', handler: 'text_transaction', enabled: true }] },
    authorization: { approved: true, action: 'apply_patch' }, isRepair: false };
  const approval: ApprovalRecord = { id: 'approval-1', proposalId: proposal.id, proposalDigest: proposal.digest,
    bridgeApprovalDigest: sha256('existing-bridge-approval'), actorId: 'alice', tenantId: 'team', projectId: 'p1',
    expiresAtMs: 9_000, revoked: false };
  return { proposal, context, approval };
}

test('only a current authenticated server approval releases the exact bridge digest', async () => {
  const { proposal, context, approval } = fixture();
  const approved = await authorizeApply(proposal, context, approval.id, { read: async () => approval }, () => context.nowMs);
  assert.equal(approved.bridgeApprovalDigest, approval.bridgeApprovalDigest);
  assert.notEqual(approved, approval);
  for (const invalid of [undefined, { ...approval, actorId: 'mallory' }, { ...approval, tenantId: 'another-team' },
    { ...approval, expiresAtMs: context.nowMs }, { ...approval, expiresAtMs: 10_001 }, { ...approval, revoked: true },
    { ...approval, proposalDigest: sha256('another proposal') }]) {
    await assert.rejects(authorizeApply(proposal, context, approval.id, { read: async () => invalid }, () => context.nowMs), /No current exact-scope approval/);
  }
  await assert.rejects(authorizeApply(proposal, context, approval.id, { read: async () => approval }, () => 9_001), /No current exact-scope approval/);
  await assert.rejects(authorizeApply(proposal, context, approval.id, { read: async () => approval }, () => 10_001), /expired/);
});

test('preserves coding modes, deployment restrictions and installed executable binding', () => {
  const { proposal, context } = fixture();
  assert.deepEqual(capabilityIssues(proposal, context), []);
  for (const patch of [{ deploymentMode: 'hosted' as const }, { workMode: 'plan' as const }, { workMode: 'debug' as const },
    { authorization: { approved: false, action: 'apply_patch' as const } }, { principal: { userId: 'bob', tenantId: 'team' } },
    { nowMs: 10_000 }, { profile: { ...context.profile, executableSha256: sha256('changed binary') } },
    { profile: { ...context.profile, exactEngineVersion: 'other-version' } }]) {
    assert.ok(capabilityIssues(proposal, { ...context, ...patch }).length > 0);
  }
});

test('a generic file writer cannot claim native node or binary-asset operations', () => {
  for (const [engine, file, targetKind] of [['unity', 'Assets/Room.unity', 'unity_asset'], ['unreal', 'Content/Room.umap', 'unreal_asset']] as const) {
    const { proposal, context } = fixture(engine, 'remove_node', file);
    context.profile.capabilities = [{ action: 'remove_node', targetKind, handler: 'text_transaction', enabled: true }];
    assert.match(capabilityIssues(proposal, context).join(' '), /No unique certified/);
    context.profile.capabilities = [{ action: 'remove_node', targetKind, handler: engine === 'unity' ? 'unity_editor' : 'unreal_editor', enabled: true }];
    assert.deepEqual(capabilityIssues(proposal, context), []);
  }
  const { proposal, context } = fixture('godot', 'custom');
  context.profile.capabilities = [{ action: 'custom', targetKind: 'source', handler: 'text_transaction', enabled: true }];
  assert.match(capabilityIssues(proposal, context).join(' '), /Unsupported action/);
});

test('duplicate/disabled capabilities and validation overrides fail closed', () => {
  const { proposal, context } = fixture();
  const entry = context.profile.capabilities[0];
  for (const capabilities of [[entry, entry], [{ ...entry, enabled: false }]]) {
    assert.ok(capabilityIssues(proposal, { ...context, profile: { ...context.profile, capabilities } }).length);
  }
  const overridden = sealProposal('override', { ...proposal.scope, actions: [{ ...proposal.scope.actions[0], params: { content: 'source', skipValidation: false } }] });
  assert.match(capabilityIssues(overridden, context).join(' '), /cannot bypass validation/);
});

test('MZ events, database and plugin registration use separate handlers', () => {
  assert.equal(classifyTarget('rpg-maker-mz', 'data/Map001.json'), 'mz_events');
  assert.equal(classifyTarget('rpg-maker-mz', 'data/Troops.json'), 'mz_events');
  assert.equal(classifyTarget('rpg-maker-mz', 'data/Actors.json'), 'mz_database');
  assert.equal(classifyTarget('rpg-maker-mz', 'js/plugins/QuestLog.js'), 'mz_plugin');
  assert.equal(classifyTarget('rpg-maker-mz', 'js/plugins.js'), 'mz_plugin_registry');
  assert.equal(classifyTarget('rpg-maker-mz', 'js/rmmz_core.js'), undefined);
  const { proposal, context } = fixture('rpg-maker-mz', 'edit_mz_events', 'data/Map001.json');
  context.profile.capabilities = [{ action: 'edit_mz_events', targetKind: 'mz_events', handler: 'mz_json_schema', enabled: true }];
  assert.ok(capabilityIssues(proposal, context).length);
  context.profile.capabilities = [{ action: 'edit_mz_events', targetKind: 'mz_events', handler: 'mz_event_schema', enabled: true }];
  assert.deepEqual(capabilityIssues(proposal, context), []);
});

test('relative-path validation catches platform-dependent escape forms', () => {
  for (const file of ['../Player.gd', '/Player.gd', 'C:/Player.gd', 'code\\Player.gd', 'code//Player.gd', './Player.gd', 'Player.gd:stream']) {
    assert.equal(classifyTarget('godot', file), undefined);
  }
});
