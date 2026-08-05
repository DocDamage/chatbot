function markdownTable(headers, rows) {
  const head = `| ${headers.join(' | ')} |`;
  const separator = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map(row => `| ${row.map(value => String(value).replace(/\|/g, '\\|')).join(' | ')} |`);
  return [head, separator, ...body].join('\n');
}

function flattenNamed(records, kind) {
  return records.flatMap(record => record.classesByKind[kind].map(name => ({ name, file: record.file })));
}

export function buildInventory(scan, reachability) {
  const records = scan.analyzed.filter(record => !record.isTest);
  const routes = records.flatMap(record => record.routes.map(route => ({ ...route, file: record.file })));
  const envVariables = [...new Set(records.flatMap(record => record.envVariables))].sort();
  const featureFlags = [...new Set(records.flatMap(record => record.featureFlags))].sort();
  const tables = records.flatMap(record => record.tables.map(name => ({ name, file: record.file })));
  const migrations = records
    .filter(record => /(?:^|\/)(?:migrations?|schema)(?:\/|\.)/i.test(record.file))
    .map(record => record.file);
  const backgroundProcesses = records
    .filter(record => record.backgroundSignals.length > 0)
    .map(record => ({ file: record.file, signals: record.backgroundSignals }));
  const externalBinaries = records.flatMap(record =>
    record.externalBinaries.map(binary => ({ binary, file: record.file }))
  );
  const oversizedFiles = records
    .filter(record => record.lines > 300)
    .map(record => ({ file: record.file, lines: record.lines }));
  const clientPanels = records
    .filter(record => record.file.startsWith('client/src/') && /(?:Panel|Workspace|Menu|Dialog|Browser)\.[jt]sx?$/.test(record.file))
    .map(record => record.file);

  return {
    schemaVersion: 1,
    summary: {
      sourceFiles: scan.sourceFiles.length,
      productionSourceFiles: reachability.reachableProduction.length + reachability.unreachable.length,
      reachableProductionFiles: reachability.reachableProduction.length,
      unreachableProductionFiles: reachability.unreachable.length,
      routes: routes.length,
      environmentVariables: envVariables.length,
      featureFlags: featureFlags.length,
      oversizedProductionFiles: oversizedFiles.length
    },
    routes,
    clientPanels,
    services: flattenNamed(records, 'services'),
    providers: flattenNamed(records, 'providers'),
    tools: flattenNamed(records, 'tools'),
    agents: flattenNamed(records, 'agents'),
    database: { tables, migrations },
    backgroundProcesses,
    environmentVariables: envVariables,
    featureFlags,
    externalBinaries,
    oversizedFiles
  };
}

export function renderInventoryMarkdown(inventory) {
  const s = inventory.summary;
  const routeRows = inventory.routes.map(route => [route.method, `\`${route.path}\``, `\`${route.file}:${route.line}\``]);
  const oversizedRows = inventory.oversizedFiles.map(file => [`\`${file.file}\``, file.lines]);
  return `# Repository Inventory\n\n` +
    `Generated deterministically by \`scripts/release/generate-repository-inventory.mjs\`. ` +
    `Do not edit generated tables by hand.\n\n` +
    `## Summary\n\n` +
    markdownTable(['Category', 'Count'], [
      ['Source files', s.sourceFiles],
      ['Production source files', s.productionSourceFiles],
      ['Reachable production files', s.reachableProductionFiles],
      ['Unreachable production files', s.unreachableProductionFiles],
      ['Discovered route calls', s.routes],
      ['Environment variables', s.environmentVariables],
      ['Feature flags', s.featureFlags],
      ['Files above 300 lines', s.oversizedProductionFiles]
    ]) + `\n\n` +
    `## Server route calls\n\n${markdownTable(['Method', 'Path', 'Source'], routeRows)}\n\n` +
    `## Client panels and workspaces\n\n${inventory.clientPanels.map(file => `- \`${file}\``).join('\n') || '- None'}\n\n` +
    `## Environment variables\n\n${inventory.environmentVariables.map(name => `- \`${name}\``).join('\n') || '- None'}\n\n` +
    `## External binaries\n\n${inventory.externalBinaries.map(item => `- \`${item.binary}\` — \`${item.file}\``).join('\n') || '- None detected statically'}\n\n` +
    `## Files above 300 lines\n\n${markdownTable(['File', 'Lines'], oversizedRows)}\n`;
}

export function renderReachabilityMarkdown(reachability) {
  return `# Production Reachability Map\n\n` +
    `Generated from static relative imports and literal \`require()\`/dynamic-import calls. ` +
    `Runtime registration is additionally constrained by \`src/server/routeManifest.ts\` and ` +
    `\`config/production-boundary.json\`.\n\n` +
    `## Entrypoints\n\n${reachability.roots.map(root => `- \`${root.entry}\`: ${root.present ? 'present' : 'missing'}`).join('\n')}\n\n` +
    `## Counts\n\n- Reachable production files: ${reachability.reachableProduction.length}\n` +
    `- Unreachable production files: ${reachability.unreachable.length}\n` +
    `- Unresolved relative imports: ${reachability.unresolvedRelativeImports.length}\n\n` +
    `## Unreachable production modules\n\n` +
    `${reachability.unreachable.map(file => `- \`${file}\``).join('\n') || '- None'}\n\n` +
    `## Static-analysis limitations\n\n` +
    `- Computed module paths cannot be resolved statically.\n` +
    `- Framework or runtime registration outside literal imports requires explicit boundary metadata.\n` +
    `- Reachability proves registration possibility, not production support or runtime verification.\n`;
}
