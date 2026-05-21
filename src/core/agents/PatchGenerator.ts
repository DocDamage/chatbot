import * as fs from 'fs';
import * as path from 'path';

export interface GeneratedPatch {
  format: 'unified-diff';
  diff: string;
  filesChanged: string[];
  explanation: string;
}

export class PatchGenerator {
  createPatchFromInstruction(message: string, workspaceRoot = process.cwd()): GeneratedPatch {
    const replace = this.parseReplaceInstruction(message);
    if (replace) {
      const absolute = this.resolveSafe(workspaceRoot, replace.filePath);
      if (!fs.existsSync(absolute)) {
        return this.createEmptyPatch(`Cannot generate patch because ${replace.filePath} does not exist.`);
      }

      const original = fs.readFileSync(absolute, 'utf8');
      if (!original.includes(replace.from)) {
        return this.createEmptyPatch(`Cannot generate patch because the target text was not found in ${replace.filePath}.`);
      }

      const updated = original.replace(replace.from, replace.to);
      return this.createUnifiedDiff(replace.filePath, original, updated, 'Generated replacement patch from explicit instruction.');
    }

    const append = this.parseAppendInstruction(message);
    if (append) {
      const absolute = this.resolveSafe(workspaceRoot, append.filePath);
      const original = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
      const separator = original.endsWith('\n') || original.length === 0 ? '' : '\n';
      const updated = `${original}${separator}${append.content}${append.content.endsWith('\n') ? '' : '\n'}`;
      return this.createUnifiedDiff(append.filePath, original, updated, 'Generated append patch from explicit instruction.');
    }

    return this.createEmptyPatch('Patch generation needs an explicit replace or append instruction with a file path.');
  }

  createEmptyPatch(explanation = 'No patch generated. The agent inspected the repo and answered from existing files.'): GeneratedPatch {
    return {
      format: 'unified-diff',
      diff: '',
      filesChanged: [],
      explanation
    };
  }

  private parseReplaceInstruction(message: string): { filePath: string; from: string; to: string } | undefined {
    const quoted = message.match(/replace\s+["']([\s\S]+?)["']\s+with\s+["']([\s\S]+?)["']\s+in\s+([^\s]+(?:\.[A-Za-z0-9]+)?)/i);
    if (quoted) {
      return {
        from: quoted[1],
        to: quoted[2],
        filePath: quoted[3].replace(/[.,;:]$/, '')
      };
    }

    return undefined;
  }

  private parseAppendInstruction(message: string): { filePath: string; content: string } | undefined {
    const quoted = message.match(/append\s+["']([\s\S]+?)["']\s+to\s+([^\s]+(?:\.[A-Za-z0-9]+)?)/i);
    if (quoted) {
      return {
        content: quoted[1],
        filePath: quoted[2].replace(/[.,;:]$/, '')
      };
    }

    return undefined;
  }

  private resolveSafe(workspaceRoot: string, workspacePath: string): string {
    const root = path.resolve(workspaceRoot);
    const absolute = path.resolve(root, workspacePath);
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error('Patch path resolves outside workspace');
    }
    return absolute;
  }

  private createUnifiedDiff(filePath: string, original: string, updated: string, explanation: string): GeneratedPatch {
    if (original === updated) {
      return this.createEmptyPatch('No patch generated because the requested change produced identical content.');
    }

    const originalLines = original.split(/\r?\n/);
    const updatedLines = updated.split(/\r?\n/);
    const diff = [
      `diff --git a/${filePath} b/${filePath}`,
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -1,${Math.max(originalLines.length, 1)} +1,${Math.max(updatedLines.length, 1)} @@`,
      ...originalLines.map(line => `-${line}`),
      ...updatedLines.map(line => `+${line}`),
      ''
    ].join('\n');

    return {
      format: 'unified-diff',
      diff,
      filesChanged: [filePath],
      explanation
    };
  }
}
