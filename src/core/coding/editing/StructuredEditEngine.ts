import * as fs from 'fs';
import * as path from 'path';
import { EditOperation, StructuredPatch } from '../types';
import { PatchConflictDetector } from './PatchConflictDetector';

export class StructuredEditEngine {
  private readonly conflicts: PatchConflictDetector;
  constructor(private readonly workspaceRoot: string) { this.conflicts = new PatchConflictDetector(workspaceRoot); }

  createPatch(operations: EditOperation[]): StructuredPatch {
    const conflicts: Array<{ path: string; reason: string }> = [];
    for (const operation of operations) {
      try {
        const check = this.conflicts.check(operation);
        if (!check.ok) conflicts.push({ path: operation.path, reason: check.reason });
        if (!operation.authorized) conflicts.push({ path: operation.path, reason: 'Operation requires explicit authorization' });
        if (operation.operation === 'delete' && !operation.reason.trim()) conflicts.push({ path: operation.path, reason: 'Delete requires a justification' });
      } catch (error: any) { conflicts.push({ path: operation.path, reason: error.message }); }
    }
    return { operations, diff: this.diff(operations, conflicts), filesChanged: operations.map(operation => operation.path), conflicts, applied: false };
  }

  fromNaturalLanguage(message: string, options: { authorized?: boolean } = {}): StructuredPatch {
    const operations: EditOperation[] = [];
    const replacePattern = /replace\s+["']([\s\S]+?)["']\s+with\s+["']([\s\S]+?)["']\s+in\s+([^\s,;]+)/gi;
    for (const match of message.matchAll(replacePattern)) {
      const file = match[3].replace(/[.,;:]$/, '');
      const absolute = this.conflicts.safe(file);
      if (!fs.existsSync(absolute)) continue;
      const expectedContent = fs.readFileSync(absolute, 'utf8');
      if (!expectedContent.includes(match[1])) continue;
      operations.push({ operation: 'modify', path: file, expectedContent, content: expectedContent.replace(match[1], match[2]), reason: 'Natural-language replacement anchored to the current file content', authorized: options.authorized === true });
    }
    const appendPattern = /append\s+["']([\s\S]+?)["']\s+to\s+([^\s,;]+)/gi;
    for (const match of message.matchAll(appendPattern)) {
      const file = match[2].replace(/[.,;:]$/, '');
      const absolute = this.conflicts.safe(file);
      const expectedContent = fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : undefined;
      const separator = expectedContent && expectedContent.length && !expectedContent.endsWith('\n') ? '\n' : '';
      operations.push({ operation: fs.existsSync(absolute) ? 'modify' : 'create', path: file, expectedContent, content: `${expectedContent || ''}${separator}${match[1]}${match[1].endsWith('\n') ? '' : '\n'}`, reason: 'Natural-language append anchored to the current file content', authorized: options.authorized === true });
    }
    const createPattern = /create\s+(?:a\s+)?file\s+([^\s,;]+)\s+with\s+["']([\s\S]+?)["']/gi;
    for (const match of message.matchAll(createPattern)) operations.push({ operation: 'create', path: match[1], content: match[2], reason: 'Natural-language file creation', authorized: options.authorized === true });
    const deletePattern = /delete\s+(?:the\s+)?file\s+([^\s,;]+)(?:\s+because\s+([^.;]+))?/gi;
    for (const match of message.matchAll(deletePattern)) operations.push({ operation: 'delete', path: match[1], reason: match[2]?.trim() || '', authorized: options.authorized === true });
    return this.createPatch(operations);
  }

  apply(patch: StructuredPatch): StructuredPatch {
    if (patch.conflicts.length) throw new Error(`Cannot apply conflicted patch: ${patch.conflicts.map(conflict => `${conflict.path}: ${conflict.reason}`).join('; ')}`);
    for (const operation of patch.operations) {
      const absolute = this.conflicts.safe(operation.path);
      if (operation.operation === 'delete') fs.unlinkSync(absolute);
      else {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, operation.content || '', 'utf8');
      }
    }
    return { ...patch, applied: true };
  }

  private diff(operations: EditOperation[], conflicts: Array<{ path: string; reason: string }>): string {
    if (conflicts.length) return '';
    return operations.map(operation => {
      const oldContent = operation.operation === 'create' ? '' : operation.expectedContent || '';
      const newContent = operation.operation === 'delete' ? '' : operation.content || '';
      const oldLines = oldContent.split(/\r?\n/); const newLines = newContent.split(/\r?\n/);
      const oldPath = operation.operation === 'create' ? '/dev/null' : `a/${operation.path}`;
      const newPath = operation.operation === 'delete' ? '/dev/null' : `b/${operation.path}`;
      return [`diff --git a/${operation.path} b/${operation.path}`, `--- ${oldPath}`, `+++ ${newPath}`, `@@ -1,${Math.max(1, oldLines.length)} +1,${Math.max(1, newLines.length)} @@`, ...oldLines.filter(Boolean).map(line => `-${line}`), ...newLines.filter(Boolean).map(line => `+${line}`), ''].join('\n');
    }).join('');
  }
}
