import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const merge = require('deepmerge');

test('rejects __proto__ poisoning for advisory target shapes', () => {
  const nullPrototypeTarget = Object.create(null);
  nullPrototypeTarget.debug = false;
  const nullPrototypeResult = merge(
    nullPrototypeTarget,
    JSON.parse('{"__proto__":{"isAdmin":true}}'),
  );
  assert.equal(nullPrototypeResult.isAdmin, undefined);
  assert.equal(nullPrototypeResult.debug, false);
  assert.equal(Object.getPrototypeOf(nullPrototypeResult), Object.prototype);

  const placeholderResult = merge(
    { session: null },
    JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}'),
  );
  assert.equal(placeholderResult.session.isAdmin, undefined);
  assert.equal(Object.getPrototypeOf(placeholderResult.session), Object.prototype);

  const poisonedTargetResult = merge(
    JSON.parse('{"__proto__":{"isAdmin":true},"debug":false}'),
    {},
  );
  assert.equal(poisonedTargetResult.isAdmin, undefined);
  assert.equal(poisonedTargetResult.debug, false);
  assert.equal(Object.getPrototypeOf(poisonedTargetResult), Object.prototype);
});

test('preserves ordinary object and array merge behavior', () => {
  assert.deepEqual(
    merge({ nested: { left: true }, items: [1] }, { nested: { right: true }, items: [2, 3] }),
    { nested: { left: true, right: true }, items: [1, 2, 3] },
  );
});
