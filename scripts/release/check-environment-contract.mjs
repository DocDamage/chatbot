import fs from 'node:fs';
import path from 'node:path';
import { stableJson, walkFiles, writeText } from './lib/files.mjs';

const root = process.cwd();
const definitionPath = 'src/core/config/EnvironmentDefinitions.ts';
const templatePath = '.env.example';
const reportPath = 'docs/architecture/generated/environment-contract.json';
const allowUndocumented = process.argv.includes('--allow-undocumented');
const writeReport = process.argv.includes('--write-report');

function parseDefinitionNames(text) {
  const objectNames = [...text.matchAll(/\bname:\s*['"]([A-Z][A-Z0-9_]*)['"]/g)].map(match => match[1]);
  const helperNames = [...text.matchAll(/\b(?:optional|secret|localOnly|deprecated)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g)].map(match => match[1]);
  return [...objectNames, ...helperNames];
}

function parseTemplateNames(text) {
  const names = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/);
    if (match) names.push(match[1]);
  }
  return names;
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function discoverEnvironmentUsage() {
  const files = walkFiles(root, {
    include: (_absolute, relative) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(relative)
  });
  const usage = new Map();
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const names = [
      ...text.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]*)\b/g),
      ...text.matchAll(/\bprocess\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g),
      ...text.matchAll(/\bimport\.meta\.env\.([A-Z][A-Z0-9_]*)\b/g)
    ].map(match => match[1]);
    for (const name of names) {
      if (!usage.has(name)) usage.set(name, new Set());
      usage.get(name).add(file);
    }
  }
  return Object.fromEntries(
    [...usage.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, filesForName]) => [name, [...filesForName].sort()])
  );
}

if (fs.existsSync(path.join(root, 'env.example'))) {
  console.error('Duplicate env.example remains. Keep only .env.example.');
  process.exit(1);
}

const definitions = parseDefinitionNames(fs.readFileSync(path.join(root, definitionPath), 'utf8'));
const template = parseTemplateNames(fs.readFileSync(path.join(root, templatePath), 'utf8'));
const usage = discoverEnvironmentUsage();
const definitionSet = new Set(definitions);
const templateSet = new Set(template);
const usedNames = Object.keys(usage);
const report = {
  schemaVersion: 1,
  definitionCount: definitionSet.size,
  templateCount: templateSet.size,
  usageCount: usedNames.length,
  duplicateDefinitions: findDuplicates(definitions),
  duplicateTemplateEntries: findDuplicates(template),
  missingFromTemplate: [...definitionSet].filter(name => !templateSet.has(name)).sort(),
  missingFromDefinitions: [...templateSet].filter(name => !definitionSet.has(name)).sort(),
  undocumentedUsage: usedNames.filter(name => !definitionSet.has(name)).sort(),
  unusedDefinitions: [...definitionSet].filter(name => !Object.hasOwn(usage, name)).sort(),
  usage
};

if (writeReport) writeText(root, reportPath, stableJson(report));

const failures = [];
for (const name of report.duplicateDefinitions) failures.push(`duplicate definition: ${name}`);
for (const name of report.duplicateTemplateEntries) failures.push(`duplicate template entry: ${name}`);
for (const name of report.missingFromTemplate) failures.push(`schema variable missing from .env.example: ${name}`);
for (const name of report.missingFromDefinitions) failures.push(`.env.example variable missing from schema: ${name}`);
if (!allowUndocumented) {
  for (const name of report.undocumentedUsage) failures.push(`used variable missing from schema/template: ${name}`);
}

if (failures.length > 0) {
  console.error('Environment contract check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  if (report.undocumentedUsage.length > 0) console.error(`Undocumented usage: ${report.undocumentedUsage.join(', ')}`);
  process.exit(1);
}

console.log(`Environment contract passed: ${definitionSet.size} definitions, ${usedNames.length} variables used.`);
