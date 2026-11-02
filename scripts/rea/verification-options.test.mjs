import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verificationOptions } from './verification-options.mjs';

test('verification options retain loopback defaults and accept isolated output/native fixtures', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-options-'));
  try {
    const file = path.join(root, 'fixture.dll');
    fs.writeFileSync(file, 'fixture');
    const options = verificationOptions([
      '--base-url',
      'http://127.0.0.1:4310/',
      '--output',
      path.join(root, 'result.json'),
      '--managed-fixture',
      file,
      '--native',
    ]);
    assert.equal(options.base, 'http://127.0.0.1:4310');
    assert.equal(options.managed, file);
    assert.equal(options.native, true);
    assert.equal(verificationOptions([], { platform: 'linux' }).base, 'http://127.0.0.1:3001');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('verification refuses non-loopback origins and incomplete flags before any request', () => {
  for (const base of [
    'https://127.0.0.1',
    'http://example.com',
    'http://user:pass@localhost',
    'http://localhost/api',
    'http://localhost?x=1',
  ])
    assert.throws(() => verificationOptions(['--base-url', base], { platform: 'linux' }));
  for (const args of [['--output'], ['--unknown'], ['--output', '--native']])
    assert.throws(() => verificationOptions(args));
});
test('Windows verification discovers a bundled managed runtime independently of Program Files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rea-managed-'));
  try {
    const fixture = path.join(
      home,
      '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/System.Management.Automation.dll'
    );
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    fs.writeFileSync(fixture, 'fixture');
    const options = verificationOptions([], { platform: 'win32', home });
    assert.ok(fs.existsSync(options.managed));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
