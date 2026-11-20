import type { ToolFile } from '../ToolWorkspace';
import type { AddDependency } from '../ProjectDependencies';

const databases: Record<string, string> = { actorId: 'Actors', classId: 'Classes', skillId: 'Skills', itemId: 'Items', weaponId: 'Weapons', armorId: 'Armors', stateId: 'States', enemyId: 'Enemies', troopId: 'Troops', tilesetId: 'Tilesets', commonEventId: 'CommonEvents', switchId: 'System', variableId: 'System' };

export function mzDependencies(records: ToolFile[], add: AddDependency, limitations: string[]): void {
  limitations.push('MZ references are static context only. Database/event edits require schema and cross-reference validators; plugin JavaScript is never evaluated.');
  for (const file of records) {
    if (file.path === 'js/plugins.js') {
      // Accept only the JSON array emitted by MZ. Arbitrary assignments/functions stay unresolved.
      const assignment = /^\s*(?:\/\/[^\n]*\n|\s)*var\s+\$plugins\s*=\s*(\[[\s\S]*\])\s*;?\s*$/.exec(file.content.replace(/^\uFEFF/, ''));
      try {
        const plugins = assignment ? JSON.parse(assignment[1]) : undefined;
        if (!Array.isArray(plugins)) throw new Error();
        for (const [order, plugin] of plugins.entries()) if (plugin && typeof plugin.name === 'string') add(file.path, `js/plugins/${plugin.name}.js`, `mz-plugin-order:${order}:${plugin.status === true ? 'enabled' : 'disabled'}`, true);
      } catch { add(file.path, '$plugins', 'mz-plugins', false, 'Plugin assignment is not a static JSON array'); }
      continue;
    }
    if (!/^data\/[^/]+\.json$/i.test(file.path)) continue;
    let document: unknown;
    try { document = JSON.parse(file.content.replace(/^\uFEFF/, '')); }
    catch { add(file.path, file.path, 'mz-data', false, 'Malformed JSON; context cannot infer database references'); continue; }
    if (Array.isArray(document) && document[0] !== null && document.length) add(file.path, 'index:0', 'mz-null-sentinel', false, 'Database array lacks the expected null sentinel; validation required');
    // Iterative traversal with a fixed node limit. Numbers are references only for known keys.
    const pending: unknown[] = [document]; let visited = 0;
    while (pending.length && visited++ < 5000) {
      const node = pending.pop(); if (!node || typeof node !== 'object') continue;
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
          if (databases[key]) add(file.path, `data/${databases[key]}.json`, `mz-${key}:${value}`, true);
          if (key === 'mapId') add(file.path, `data/Map${String(value).padStart(3, '0')}.json`, `mz-map:${value}`, true);
        } else if (value && typeof value === 'object') pending.push(value);
      }
    }
    if (pending.length) limitations.push(`MZ node budget reached in ${file.path}; some references were omitted.`);
    if (/^data\/Map\d+\.json$/i.test(file.path)) add(file.path, 'data/MapInfos.json', 'mz-map-catalog', true);
  }
}
