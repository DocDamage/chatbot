import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFinding, scanText } from '../lib/secret-scan.mjs';

test('secret scanner detects supported credential shapes without exposing values', () => {
  const value = `github_pat_${'A'.repeat(60)}`;
  const [finding] = scanText(`token=${value}`, 'fixture.txt');

  assert.equal(finding.rule, 'github-token');
  assert.equal(finding.source, 'fixture.txt');
  assert.equal(finding.line, 1);
  assert.equal(finding.fingerprint.length, 12);
  assert.equal(formatFinding(finding).includes(value), false);
});

test('secret scanner honors fingerprint allowlisting and placeholder markers', () => {
  const value = `sk-${'A'.repeat(30)}`;
  const [finding] = scanText(value, 'fixture.txt');
  assert.equal(scanText(value, 'fixture.txt', new Set([finding.fingerprint])).length, 0);
  assert.equal(scanText(`example=${value}`, 'fixture.txt').length, 0);
});

test('secret scanner ignores binary content', () => {
  assert.deepEqual(scanText('prefix\0sk-1234567890abcdefghijklmnop', 'fixture.bin'), []);
});
