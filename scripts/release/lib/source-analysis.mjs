import path from 'node:path';
import { lineCount, readText, walkFiles } from './files.mjs';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const TEST_FILE = /(?:^|\/)(?:__tests__|test|tests)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/;

function allMatches(text, regex, mapper) {
  const values = [];
  for (const match of text.matchAll(regex)) values.push(mapper(match));
  return values;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

export function analyzeSourceFile(file, text) {
  const imports = [
    ...allMatches(text, /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g, match => match[1]),
    ...allMatches(text, /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, match => match[1]),
    ...allMatches(text, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, match => match[1])
  ];

  const envVariables = [
    ...allMatches(text, /\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g, match => match[1]),
    ...allMatches(text, /\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g, match => match[1]),
    ...allMatches(text, /\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g, match => match[1])
  ];

  const routes = [];
  for (const match of text.matchAll(/\b(app|router)\.(get|post|put|patch|delete|options|head|all|use)\(\s*['"`]([^'"`]+)['"`]/g)) {
    routes.push({
      receiver: match[1],
      method: match[2].toUpperCase(),
      path: match[3],
      line: lineForOffset(text, match.index ?? 0)
    });
  }

  const classes = allMatches(text, /\b(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g, match => match[1]);
  const functions = allMatches(text, /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, match => match[1]);
  const tables = allMatches(text, /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([A-Za-z0-9_.-]+)/gi, match => match[1]);
  const externalBinaries = allMatches(
    text,
    /\b(?:spawn|spawnSync|execFile|execFileSync)\(\s*['"]([^'"]+)['"]/g,
    match => match[1]
  );
  const backgroundSignals = [];
  if (/\b(?:setInterval|setTimeout)\s*\(/.test(text)) backgroundSignals.push('timer');
  if (/\bcron\.(?:schedule|validate)\s*\(/.test(text) || /node-cron/.test(text)) backgroundSignals.push('cron');
  if (/\b(?:Queue|Worker|Job|Scheduler)\b/.test(text)) backgroundSignals.push('queue-or-worker');
  if (/\bWebSocketServer\b/.test(text)) backgroundSignals.push('websocket');
  if (/\bprocess\.on\(\s*['"](?:SIGTERM|SIGINT|exit|uncaughtException)/.test(text)) backgroundSignals.push('process-lifecycle');

  const featureFlags = envVariables.filter(name => /^(?:ENABLE|USE|FEATURE|DISABLE)_/.test(name));
  const classesByKind = {
    services: classes.filter(name => /(?:Service|Manager|Orchestrator|Registry|Processor|Controller|Coordinator)$/.test(name)),
    providers: classes.filter(name => /(?:Provider|Adapter|Client|LLM)$/.test(name) || file.includes('/providers/')),
    tools: classes.filter(name => /Tool$/.test(name) || file.includes('/tools/')),
    agents: classes.filter(name => /Agent$/.test(name) || file.includes('/agents/'))
  };

  return {
    file,
    lines: lineCount(text),
    imports: uniqueSorted(imports),
    envVariables: uniqueSorted(envVariables),
    featureFlags: uniqueSorted(featureFlags),
    routes,
    classes: uniqueSorted(classes),
    functions: uniqueSorted(functions),
    tables: uniqueSorted(tables),
    externalBinaries: uniqueSorted(externalBinaries),
    backgroundSignals: uniqueSorted(backgroundSignals),
    classesByKind,
    isTest: TEST_FILE.test(file)
  };
}

export function scanRepository(root) {
  const sourceFiles = walkFiles(root, {
    include: (_absolute, relative) => SOURCE_EXTENSIONS.has(path.extname(relative))
  });
  const analyzed = sourceFiles.map(file => analyzeSourceFile(file, readText(root, file)));
  return { sourceFiles, analyzed };
}

export function isProductionSource(file) {
  const inProductionTree = file.startsWith('src/') || file.startsWith('client/src/');
  return inProductionTree && SOURCE_EXTENSIONS.has(path.extname(file)) && !TEST_FILE.test(file);
}
