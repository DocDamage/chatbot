import fs from 'fs';
import os from 'os';
import path from 'path';
import { RepositoryIntelligence } from './repository/RepositoryIntelligence';

describe('RepositoryIntelligence', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-intelligence-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('captures manifests, local instructions, project roots, and languages', () => {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Use focused tests.');
    fs.writeFileSync(path.join(root, 'package.json'), '{"scripts":{"test":"jest"}}');
    fs.mkdirSync(path.join(root, 'services', 'worker'), { recursive: true });
    fs.writeFileSync(path.join(root, 'services', 'worker', 'Cargo.toml'), '[package]\nname="worker"');
    fs.writeFileSync(path.join(root, 'src', 'main.rs'), 'fn main() {}');
    fs.mkdirSync(path.join(root, '.pytest_cache'), { recursive: true });
    fs.writeFileSync(path.join(root, '.pytest_cache', 'lastfailed'), '{}');
    const snapshot = new RepositoryIntelligence(root).snapshot();
    expect(snapshot.instructions[0].path).toBe('AGENTS.md');
    expect(snapshot.manifests.map(manifest => manifest.path)).toContain('package.json');
    expect(snapshot.languages.languages.map(language => language.language)).toContain('rust');
    expect(snapshot.projectRoots.length).toBeGreaterThan(0);
    expect(snapshot.projectRoots.some(project => project.path.endsWith(path.join('services', 'worker')))).toBe(true);
    expect(snapshot.parserHealth.some(parser => parser.parser.startsWith('tree-sitter:rust'))).toBe(true);
    expect(snapshot.files.some(file => file.path.includes('.pytest_cache'))).toBe(false);
  });
});
