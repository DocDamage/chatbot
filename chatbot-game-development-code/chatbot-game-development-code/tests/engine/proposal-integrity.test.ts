import test from 'node:test';
import assert from 'node:assert/strict';
import { assertInputsUnchanged, canonicalJson, digestJson, sealProposal, sha256, type ProposalScope } from '../../src/engine/proposal-integrity.js';

function scope(): ProposalScope {
  return { schemaVersion: 1, runId: 'run-1', projectId: 'project-1', canonicalProjectRoot: '/projects/one',
    requesterId: 'alice', tenantId: 'tenant-1', environment: 'local', engine: 'godot', exactEngineVersion: '4.7.1',
    profileDigest: sha256('profile'), adapterVersion: '2.0.0', executablePath: '/tools/godot', executableSha256: sha256('exe'),
    actions: [{ type: 'update_script', targetPath: 'Player.gd', params: { content: 'extends Node\n', nested: { amount: 4 } } }],
    inputFileHashes: { 'Player.gd': sha256('old') }, expectedOutputs: ['Player.gd'],
    verificationPlanDigest: sha256('checks'), expiresAtMs: 10_000 };
}

test('canonicalization covers nested fields and preserves action ordering', () => {
  assert.equal(canonicalJson({ b: { z: 1, a: 2 }, a: 3 }), canonicalJson({ a: 3, b: { a: 2, z: 1 } }));
  const original = scope();
  const variants: ProposalScope[] = [
    { ...original, actions: [{ ...original.actions[0], params: { content: 'extends Node2D\n', nested: { amount: 4 } } }] },
    { ...original, inputFileHashes: { 'Player.gd': sha256('external-change') } },
    { ...original, exactEngineVersion: '4.7.2' },
    { ...original, executableSha256: sha256('replacement-exe') },
    { ...original, tenantId: 'another-tenant' },
    { ...original, verificationPlanDigest: sha256('weaker-tests') },
  ];
  for (const variant of variants) assert.notEqual(digestJson(variant), digestJson(original));
  assert.notEqual(digestJson([{ a: 1 }, { a: 2 }]), digestJson([{ a: 2 }, { a: 1 }]));
});

test('unsupported JSON values cannot silently disappear from an approval digest', () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const value of [NaN, Infinity, -0, undefined, { x: undefined }, new Date(0), cycle, new Array(2),
    Object.defineProperty({}, 'x', { get: () => 3, enumerable: true }),
    Object.defineProperty([1], 'hidden', { value: 1 }), Object.assign([1], { [Symbol('hidden')]: 1 })]) {
    assert.throws(() => canonicalJson(value));
  }
});

test('sealing copies and freezes all approved action content', () => {
  const draft = scope();
  const proposal = sealProposal('proposal-1', draft);
  (draft.actions[0].params as { content: string }).content = 'changed after review';
  assert.notEqual(digestJson(draft), proposal.digest);
  assert.equal(digestJson(proposal.scope), proposal.digest);
  assert.throws(() => { (proposal.scope.actions[0].params as { content: string }).content = 'tamper'; }, TypeError);
});

test('missing input observations differ from a verified absent file', () => {
  const draft = { ...scope(), inputFileHashes: { 'Player.gd': null } };
  const proposal = sealProposal('new-file', draft);
  assertInputsUnchanged(proposal, { 'Player.gd': null });
  assert.throws(() => assertInputsUnchanged(proposal, {}), /not checked/);
  assert.throws(() => assertInputsUnchanged(proposal, { 'Player.gd': sha256('unexpected new file') }), /Input changed/);
  assert.throws(() => sealProposal('no-baseline', { ...scope(), inputFileHashes: {} }), /explicit input file hash/);
});
