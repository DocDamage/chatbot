import { normalizeImportPath } from './files.mjs';
import { isProductionSource } from './source-analysis.mjs';

export const DEFAULT_ENTRYPOINTS = [
  'src/server/index.ts',
  'client/src/main.tsx'
];

export function buildReachability(scan, entrypoints = DEFAULT_ENTRYPOINTS) {
  const candidates = new Set(scan.sourceFiles);
  const byFile = new Map(scan.analyzed.map(record => [record.file, record]));
  const resolvedImports = new Map();
  const unresolvedRelativeImports = [];

  for (const record of scan.analyzed) {
    const resolved = [];
    for (const specifier of record.imports) {
      if (!specifier.startsWith('.')) continue;
      const target = normalizeImportPath(record.file, specifier, candidates);
      if (target) resolved.push(target);
      else unresolvedRelativeImports.push({ importer: record.file, specifier });
    }
    resolvedImports.set(record.file, [...new Set(resolved)].sort());
  }

  const missingEntrypoints = entrypoints.filter(entry => !candidates.has(entry));
  const reachable = new Set();
  const queue = entrypoints.filter(entry => candidates.has(entry));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    for (const dependency of resolvedImports.get(current) ?? []) {
      if (!reachable.has(dependency)) queue.push(dependency);
    }
  }

  const productionFiles = scan.sourceFiles.filter(isProductionSource).sort();
  const unreachable = productionFiles.filter(file => !reachable.has(file));
  const reachableProduction = productionFiles.filter(file => reachable.has(file));

  const roots = entrypoints.map(entry => ({
    entry,
    present: candidates.has(entry),
    directImports: resolvedImports.get(entry) ?? []
  }));

  return {
    entrypoints,
    missingEntrypoints,
    roots,
    reachable: [...reachable].sort(),
    reachableProduction,
    unreachable,
    unresolvedRelativeImports: unresolvedRelativeImports.sort((a, b) =>
      `${a.importer}:${a.specifier}`.localeCompare(`${b.importer}:${b.specifier}`)
    ),
    importGraph: Object.fromEntries(
      [...resolvedImports.entries()].sort(([a], [b]) => a.localeCompare(b))
    ),
    sourceRecordCount: byFile.size
  };
}
