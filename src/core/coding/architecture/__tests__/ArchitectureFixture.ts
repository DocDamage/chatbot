import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ArchitectureFixture {
  root: string;
  marker: string;
  cleanup(): void;
}

export function createArchitectureFixture(): ArchitectureFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-fixture-'));
  const marker = path.join(root, 'REPOSITORY_CODE_EXECUTED');
  const write = (file: string, content: string | Buffer): void => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  write('package.json', JSON.stringify({
    name: 'mixed-architecture-fixture',
    version: '1.0.0',
    scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' },
    dependencies: { express: '^5.0.0', tailwindcss: '^4.0.0' }
  }, null, 2));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.' } }, null, 2));
  write('src/index.ts', [
    "import { router } from './routes';",
    "import { getUsers } from './service';",
    "app.use('/api', router);",
    'getUsers();',
    'app.listen(3000);'
  ].join('\n'));
  write('src/routes.ts', [
    "import { Router } from 'express';",
    "import { getUsers } from './service';",
    'export const router = Router();',
    "router.get('/users', getUsers);"
  ].join('\n'));
  write('src/service.ts', [
    'export function getUsers() {',
    "  return database.prepare('SELECT * FROM users').all();",
    '}'
  ].join('\n'));
  write('src/service.test.ts', [
    "import { getUsers } from './service';",
    "test('returns users', () => expect(getUsers()).toBeDefined());"
  ].join('\n'));
  write('src/duplicate-a.ts', 'export function duplicate() { return 1; }\n');
  write('src/duplicate-b.ts', 'export function duplicate() { return 1; }\n');
  write('src/static-only.ts', [
    "import fs from 'fs';",
    `fs.writeFileSync(${JSON.stringify(marker)}, 'unsafe');`
  ].join('\n'));
  write('migrations/001_create_users.sql', [
    'CREATE TABLE users (id INTEGER PRIMARY KEY);',
    'INSERT INTO users (id) VALUES (1);'
  ].join('\n'));

  write('python/main.py', 'from python.helper import run\nif __name__ == "__main__":\n    run()\n');
  write('python/helper.py', 'def run():\n    return "ok"\n');
  write('native/main.c', '#include "helper.h"\nint main(void) { return helper(); }\n');
  write('native/helper.h', 'int helper(void);\n');
  write('go.mod', 'module example.com/mixed\n\ngo 1.24\n');
  write('cmd/main.go', [
    'package main',
    'import (',
    '  "example.com/mixed/internal/api"',
    ')',
    'func main() { api.Run() }'
  ].join('\n'));
  write('internal/api/api.go', 'package api\nfunc Run() {}\n');
  write('rust/Cargo.toml', '[package]\nname = "mixed-rust"\nversion = "0.1.0"\n[dependencies]\nserde = "1"\n');
  write('rust/src/lib.rs', 'use crate::helper::answer;\npub fn run() -> i32 { answer() }\n');
  write('rust/src/helper.rs', 'pub fn answer() -> i32 { 42 }\n');
  write('scripts/main.lua', 'local helper = require("scripts.helper")\nreturn helper.run()\n');
  write('scripts/helper.lua', 'local M = {}\nfunction M.run() return true end\nreturn M\n');
  write('ui/Widget.svelte', '<script lang="ts">\nimport { getUsers } from "../src/service";\n</script>\n<button>{getUsers()}</button>\n');
  write('styles/app.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  write('generated/ignored.generated.ts', 'export const ignored = true;\n');
  write('assets/binary.dat', Buffer.from([0, 1, 2, 3]));

  return {
    root,
    marker,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}
