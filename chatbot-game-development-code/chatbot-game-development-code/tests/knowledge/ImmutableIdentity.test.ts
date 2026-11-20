import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createChunkIdentity, createSnapshotIdentity, MAX_CHUNK_UTF8_BYTES, sha256Utf8, validateSourcePath } from '../../src/knowledge/ImmutableIdentity';
import type { SnapshotInput } from '../../src/knowledge/ImmutableIdentity';

const source: SnapshotInput = {
  corpusId: 'public:gamedev', sourceKey: 'github:example/game-docs',
  revision: { kind: 'git-commit', value: 'a'.repeat(40) }, manifestSha256: 'b'.repeat(64),
  extractorVersion: 'rst-v1', chunkerVersion: 'sections-v1',
};
const content = 'move_and_slide()\n';
const locator = { kind: 'lines' as const, startLine: 1, endLine: 1, part: 0 };

test('snapshot IDs are reproducible without depending on object insertion order', () => {
  const reordered: SnapshotInput = {
    chunkerVersion: source.chunkerVersion, extractorVersion: source.extractorVersion,
    revision: { value: source.revision.value, kind: source.revision.kind },
    sourceKey: source.sourceKey, manifestSha256: source.manifestSha256, corpusId: source.corpusId,
  };
  assert.equal(createSnapshotIdentity(source).snapshotId, createSnapshotIdentity(reordered).snapshotId);
  assert.ok(Object.isFrozen(createSnapshotIdentity(source).revision));
});

test('every snapshot scope, revision, manifest, and transform participates in identity', () => {
  const original = createSnapshotIdentity(source).snapshotId;
  const mutations: SnapshotInput[] = [
    { ...source, corpusId: 'private:project-a' }, { ...source, sourceKey: 'github:example/fork' },
    { ...source, revision: { kind: 'git-commit', value: 'c'.repeat(40) } },
    { ...source, manifestSha256: 'd'.repeat(64) },
    { ...source, extractorVersion: 'rst-v2' }, { ...source, chunkerVersion: 'sections-v2' },
  ];
  for (const changed of mutations) assert.notEqual(createSnapshotIdentity(changed).snapshotId, original);
});

test('moving refs and abbreviated revisions are rejected', () => {
  for (const value of ['main', 'v4.3.0', 'abcdef0', 'A'.repeat(40)]) {
    assert.throws(() => createSnapshotIdentity({ ...source, revision: { kind: 'git-commit', value } }));
  }
  assert.doesNotThrow(() => createSnapshotIdentity({ ...source, revision: { kind: 'artifact-sha256', value: 'e'.repeat(64) } }));
  assert.throws(() => createSnapshotIdentity({ ...source, revision: { kind: 'artifact-sha256', value: 'e'.repeat(40) } }));
});

test('identical bytes deduplicate without collapsing version ownership', () => {
  const firstSnapshot = createSnapshotIdentity(source).snapshotId;
  const secondSnapshot = createSnapshotIdentity({ ...source, revision: { kind: 'git-commit', value: 'f'.repeat(40) } }).snapshotId;
  const first = createChunkIdentity({ snapshotId: firstSnapshot, sourcePath: 'classes/character.rst', locator, content });
  const second = createChunkIdentity({ snapshotId: secondSnapshot, sourcePath: 'classes/character.rst', locator, content });
  assert.equal(first.contentSha256, second.contentSha256);
  assert.notEqual(first.chunkId, second.chunkId);
  assert.equal(first.contentSha256, sha256Utf8(content));
});

test('path punctuation, case, locator, and content cannot collide through slugification', () => {
  const snapshotId = createSnapshotIdentity(source).snapshotId;
  const first = createChunkIdentity({ snapshotId, sourcePath: 'a/b-c.gd', locator, content });
  for (const changed of [
    { sourcePath: 'a_b/c.gd', locator, content },
    { sourcePath: 'a/B-c.gd', locator, content },
    { sourcePath: 'a/b-c.gd', locator: { ...locator, part: 1 }, content },
    { sourcePath: 'a/b-c.gd', locator, content: content.replace('\n', '\r\n') },
  ]) assert.notEqual(createChunkIdentity({ snapshotId, ...changed }).chunkId, first.chunkId);
});

test('unsafe path spellings fail instead of being silently normalized', () => {
  for (const path of ['/a.gd', '../a.gd', 'a/../b.gd', 'a//b.gd', './b.gd', 'C:/b.gd', 'a\\b.gd', 'a\u0000.gd']) {
    assert.throws(() => validateSourcePath(path), path);
  }
  assert.doesNotThrow(() => validateSourcePath('docs/with spaces/über.rst'));
});

test('UTF-8 byte bounds, malformed Unicode, empty text, and invalid locators fail', () => {
  const base = { snapshotId: createSnapshotIdentity(source).snapshotId, sourcePath: 'x.gd', locator };
  assert.throws(() => createChunkIdentity({ ...base, content: '€'.repeat(Math.floor(MAX_CHUNK_UTF8_BYTES / 3) + 1) }));
  assert.throws(() => createChunkIdentity({ ...base, content: '\ud800' }));
  assert.throws(() => createChunkIdentity({ ...base, content: ' \n' }));
  assert.throws(() => createChunkIdentity({ ...base, content, locator: { ...locator, startLine: 0 } }));
  assert.throws(() => createChunkIdentity({ ...base, content, locator: { ...locator, startLine: 2, endLine: 1 } }));
  assert.throws(() => createChunkIdentity({ ...base, content, locator: { kind: 'section', anchor: '', part: 0 } }));
  assert.doesNotThrow(() => createChunkIdentity({ ...base, content: '🎮', locator: { kind: 'section', anchor: 'movement', part: 0 } }));
});
