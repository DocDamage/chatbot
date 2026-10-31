/** Public fast-check 4 API examples; no model-generated claims about executed tests. */
export const fastCheckGuidance = `Property-based test guidance (fast-check 4):
The target project must declare fast-check as a devDependency and install it separately; do not assume an unavailable package exists.
CommonJS: const fc = require('fast-check'); const assert = require('node:assert/strict'); const { test } = require('node:test');
The assertion module itself is the assert function/object: do not destructure { assert } from node:assert/strict, which has no such export.
test('addition identity', () => { fc.assert(fc.property(fc.integer({ min: -100000, max: 100000 }), value => { assert.equal(add(value, 0), value); }), { numRuns: 100, seed: 20261031 }); });
Use fc.array(fc.integer(), { maxLength: 50 }) for integer arrays, fc.string() for strings, and fc.asyncProperty with an awaited fc.assert for async functions.
Assert the requested behavior, boundaries and input preservation. Preserve existing assertions; never swallow assertion failures, filter out failing cases or replace the implementation under test.
Keep a reproducible seed and at least 100 runs unless task requirements differ. Test callbacks finish by returning; node:test has no Tape-style t.end().
When requested behavior has a reference expectation, assert it as well as algebraic properties: identity functions can satisfy reverse(reverse(xs)) === xs without actually reversing anything.
Documentation: https://fast-check.dev/docs/core-blocks/runners/`;
