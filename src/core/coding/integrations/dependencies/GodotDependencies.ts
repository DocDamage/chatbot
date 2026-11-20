import type { ToolFile } from '../ToolWorkspace';
import type { AddDependency } from '../ProjectDependencies';

export function godotDependencies(records: ToolFile[], add: AddDependency): void {
  const uids = new Map<string, string[]>();
  const register = (uid: string, file: string) => uids.set(uid, [...(uids.get(uid) || []), file]);
  for (const file of records) {
    if (file.path.endsWith('.uid') && /^uid:\/\/[a-z0-9]+\s*$/i.test(file.content.trim())) register(file.content.trim(), file.path.slice(0, -4));
    for (const match of file.content.matchAll(/^\[gd_(?:scene|resource)\b[^\]\r\n]*\buid="(uid:\/\/[a-z0-9]+)"/gmi)) register(match[1], file.path);
  }
  for (const file of records) {
    if (!/\.(?:gd|tscn|tres|godot|gdshader|gdshaderinc)$/i.test(file.path)) continue;
    // Line comments do not establish dependencies. Strings with # remain intact.
    const source = file.content.split(/\r?\n/).map(line => line.match(/(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^#"'])*/)?.[0] || '').join('\n');
    for (const match of source.matchAll(/["'](res:\/\/[^"'\r\n]+|uid:\/\/[a-z0-9]+)["']/gi)) {
      if (match[1].startsWith('uid://')) {
        const targets = [...new Set(uids.get(match[1]) || [])];
        if (targets.length === 1) add(file.path, targets[0], 'godot-uid', true);
        else add(file.path, match[1], 'godot-uid', false, 'UID has no unique mapping in the bounded project source index');
      } else add(file.path, match[1], 'godot-resource', true);
    }
    for (const match of source.matchAll(/\b(?:preload|load)\(\s*(["'])([^"'\r\n]+)\1\s*\)/g)) {
      if (!match[2].includes('://')) add(file.path, match[2], 'godot-load');
    }
    for (const match of source.matchAll(/\b(?:preload|load)\(\s*([^\r\n)]*)\)/g)) if (!/^["'][^"']*["']\s*$/.test(match[1])) add(file.path, match[1], 'godot-dynamic-load', false, 'Dynamic expressions are not evaluated');
    for (const match of source.matchAll(/\b(?:ExtResource|SubResource|NodePath)\(\s*"([^"]+)"\s*\)/g)) add(file.path, match[1], 'godot-local-reference', false, 'Scene-local resource/node identity; requires scene inspection, not a guessed file');
    for (const match of source.matchAll(/\b(?:signal\s+([a-z_][a-z0-9_]*)|Input\.is_action_[a-z_]+\(\s*"([^"]+)")/gi)) add(file.path, match[1] || match[2], 'godot-signal-or-input', false, 'Named signal/input action; static identity only');
  }
}
