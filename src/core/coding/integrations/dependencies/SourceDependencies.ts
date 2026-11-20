import path from 'path';
import type { ToolFile } from '../ToolWorkspace';
import type { ProjectFileKind } from '../../security/WorkspaceFilePolicy';
import type { AddDependency } from '../ProjectDependencies';

export function sourceDependencies(records: ToolFile[], known: Set<string>, kind: ProjectFileKind, add: AddDependency, limitations: string[]): void {
  if (kind === 'rom') {
    limitations.push('Assembly includes are static source context. Binary includes are metadata only; no ROM bytes, assembler execution or address inference.');
    for (const file of records) if (/\.(?:asm|s|inc)$/i.test(file.path)) {
      for (const line of file.content.split(/\r?\n/)) {
        const match = /^\s*\.?((?:incsrc|include|incbin))\s+(["'])([^"'\r\n]+)\2(?:\s*(?:;.*)?)?\s*$/i.exec(line);
        if (match) add(file.path, match[3], match[1].toLowerCase() === 'incbin' ? 'rom-binary-include' : 'rom-source-include');
      }
    }
  } else if (kind === 'unreal') {
    limitations.push('Unreal source includes are static and ambiguous matches stay unresolved. Build rules are not executed; native assets require editor inspection.');
    for (const file of records) if (/\.(?:c|cpp|h|hpp)$/i.test(file.path)) for (const match of file.content.matchAll(/^\s*#include\s*"([^"\r\n]+)"/gm)) {
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), match[1]));
      const candidates = [...known].filter(candidate => candidate.endsWith(`/${match[1]}`));
      if (known.has(relative)) add(file.path, relative, 'unreal-include', true);
      else if (candidates.length === 1) add(file.path, candidates[0], 'unreal-include', true);
      else add(file.path, match[1], 'unreal-include', false, 'No unique in-project header; engine/package include roots are not guessed');
    }
  } else if (kind === 'unity') {
    limitations.push('Unity GUIDs/assembly references are static metadata only; serialized assets require authoritative editor inspection.');
    const guids = new Map<string, string[]>();
    for (const file of records) if (file.path.endsWith('.meta')) {
      const guid = /^guid:\s*([a-f0-9]{32})\s*$/m.exec(file.content)?.[1];
      if (guid) guids.set(guid, [...(guids.get(guid) || []), file.path.slice(0, -5)]);
    }
    for (const file of records) for (const match of file.content.matchAll(/\b(?:guid:\s*|GUID:)([a-f0-9]{32})\b/g)) {
      const targets = guids.get(match[1]) || [];
      if (targets.length === 1) add(file.path, targets[0], 'unity-guid', true);
      else add(file.path, match[1], 'unity-guid', false, 'GUID has no unique mapping in the bounded metadata index');
    }
  }
}
