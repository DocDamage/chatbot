import fs from 'fs';
import os from 'os';
import path from 'path';
import { PatchGenerator } from './PatchGenerator';

describe('PatchGenerator', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-generator-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('creates a non-empty unified diff for explicit replacement instructions', () => {
    const filePath = 'src/app.ts';
    const absolutePath = path.join(workspaceRoot, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'const answer = "old";\n', 'utf8');

    const patch = new PatchGenerator().createPatchFromInstruction(
      'replace "old" with "new" in src/app.ts',
      workspaceRoot
    );

    expect(patch.diff).toContain('diff --git a/src/app.ts b/src/app.ts');
    expect(patch.diff).toContain('-const answer = "old";');
    expect(patch.diff).toContain('+const answer = "new";');
    expect(patch.filesChanged).toEqual(['src/app.ts']);
  });

  it('creates a non-empty unified diff for explicit append instructions', () => {
    const patch = new PatchGenerator().createPatchFromInstruction(
      'append "export const enabled = true;" to src/feature.ts',
      workspaceRoot
    );

    expect(patch.diff).toContain('+++ b/src/feature.ts');
    expect(patch.diff).toContain('+export const enabled = true;');
    expect(patch.filesChanged).toEqual(['src/feature.ts']);
  });

  it('rejects paths outside the workspace', () => {
    expect(() => {
      new PatchGenerator().createPatchFromInstruction(
        'append "bad" to ../outside.ts',
        workspaceRoot
      );
    }).toThrow('Patch path resolves outside workspace');
  });
});
