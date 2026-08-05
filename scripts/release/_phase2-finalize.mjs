import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const missing = [
  'ALLOW_PRIVATE_WEBHOOK_URLS','ASSEMBLYAI_API_KEY','BING_API_KEY','BLACKBELT_SOURCE_DIR','BRANCH_PROTECTION_TOKEN',
  'CARTESIA_API_KEY','CEREBRAS_API_KEY','CEREBRAS_MODEL','CLAUDE_MODEL','CODE_EXECUTOR_TIMEOUT','COHERE_API_KEY',
  'COHERE_MODEL','COMICVINE_API_KEY','CUDA_VISIBLE_DEVICES','DEBUG_MODE','DEEPSEEK_API_KEY','DEEPSEEK_MODEL',
  'ELEVENLABS_API_KEY','ENABLE_AGENT_PATCH_APPLY','ENABLE_FILE_LOGGING','EUROPEANA_API_KEY','EVAL_TARGET_URL',
  'FILE_SEARCH_MAX_CONTENT_BYTES','FILE_SEARCH_MAX_FILES','FL_STUDIO_MCP_ARGS','FL_STUDIO_MCP_COMMAND','FL_STUDIO_MCP_CWD',
  'GENERAL_CORPUS_DELAY_MS','GENERAL_CORPUS_LIMIT','GENERAL_CORPUS_RETRIES','GENERAL_CORPUS_RETRY_DELAY_MS',
  'GENERAL_CORPUS_TOPICS','GENERAL_CORPUS_YEAR_EVENTS','GIS_ARCGIS_PARCEL_LAYER_URL','GIS_DEFAULT_CENTER_LAT',
  'GIS_DEFAULT_CENTER_LNG','GIS_GEOCODER_PROVIDER','GIS_PARCEL_PROVIDER','GIS_PROVIDER_CACHE_TTL_SECONDS',
  'GIS_REDACT_EXACT_ADDRESSES','GIS_ROUTING_PROVIDER','GITHUB_BRANCH','GITHUB_PAGES','GITHUB_REPOSITORY',
  'GOOGLE_API_KEY','GOOGLE_BOOKS_API_KEY','GOOGLE_CSE_ID','GPT4V_MODEL','GPU_AVAILABLE','GPU_MEMORY_MB','GROQ_API_KEY',
  'GROQ_MODEL','KNOWLEDGE_GRAPH_MAX_FILES','LOCAL_KNOWLEDGE_WIKI_DIR','LOGS_DIR','NODE_OPTIONS','NVIDIA_VISIBLE_DEVICES',
  'OMDB_API_KEY','OPENROUTER_API_KEY','OPENROUTER_MODEL','OSRM_BASE_URL','PATH','PIXELORAMA_CLI_ARGS_JSON',
  'POLYGON_API_KEY','POSTGRES_VECTOR_TEST_URL','PUBLIC_KNOWLEDGE_BASE_DIR','RATE_LIMIT_FAIL_OPEN',
  'RUN_FL_STUDIO_MCP_BRIDGE_TEST','SEARCH_API_KEY','SEARCH_ENGINE','SEC_QUEUE_MAX_ITEMS','SIXSIGMA_ANALYSIS_API_KEY',
  'SIXSIGMA_ANALYSIS_API_URL','SMITHSONIAN_API_KEY','TEMP','USERPROFILE','VITE_PUBLIC_API_BASE_URL','VITE_RUNTIME_MODE',
  'WIKIPEDIA_API_BASE'
];

const secretMarkers = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'ACCOUNT_SID'];
const localNames = new Set([
  'BLACKBELT_SOURCE_DIR','CODE_EXECUTOR_TIMEOUT','ENABLE_AGENT_PATCH_APPLY','FILE_SEARCH_MAX_CONTENT_BYTES',
  'FILE_SEARCH_MAX_FILES','FL_STUDIO_MCP_ARGS','FL_STUDIO_MCP_COMMAND','FL_STUDIO_MCP_CWD','LOCAL_KNOWLEDGE_WIKI_DIR',
  'LOGS_DIR','PIXELORAMA_CLI_ARGS_JSON','PUBLIC_KNOWLEDGE_BASE_DIR','RUN_FL_STUDIO_MCP_BRIDGE_TEST',
  'SIXSIGMA_ANALYSIS_API_URL'
]);
const ambient = new Set([
  'CUDA_VISIBLE_DEVICES','DEBUG_MODE','EVAL_TARGET_URL','GITHUB_BRANCH','GITHUB_PAGES','GITHUB_REPOSITORY',
  'GPU_AVAILABLE','GPU_MEMORY_MB','NODE_OPTIONS','NVIDIA_VISIBLE_DEVICES','PATH','POSTGRES_VECTOR_TEST_URL',
  'TEMP','USERPROFILE','VITE_PUBLIC_API_BASE_URL','VITE_RUNTIME_MODE'
]);

function category(name) {
  if (ambient.has(name)) return 'build-and-system';
  if (name.startsWith('GIS_') || name === 'OSRM_BASE_URL') return 'gis';
  if (name.startsWith('GENERAL_CORPUS_') || ['PUBLIC_KNOWLEDGE_BASE_DIR','LOCAL_KNOWLEDGE_WIKI_DIR','KNOWLEDGE_GRAPH_MAX_FILES','WIKIPEDIA_API_BASE'].includes(name)) return 'knowledge';
  if (name.startsWith('FL_STUDIO_') || name.startsWith('PIXELORAMA_') || localNames.has(name)) return 'local-tools';
  if (name.endsWith('_MODEL') || ['CEREBRAS_MODEL','CLAUDE_MODEL','COHERE_MODEL','DEEPSEEK_MODEL','GROQ_MODEL','OPENROUTER_MODEL','GPT4V_MODEL'].includes(name)) return 'providers';
  if (secretMarkers.some(marker => name.includes(marker))) return 'providers-and-integrations';
  if (name.startsWith('SEC_')) return 'integrations';
  if (name.startsWith('FILE_SEARCH_')) return 'files';
  if (name.startsWith('SIXSIGMA_') || name === 'BLACKBELT_SOURCE_DIR') return 'six-sigma';
  if (['ALLOW_PRIVATE_WEBHOOK_URLS','RATE_LIMIT_FAIL_OPEN'].includes(name)) return 'security';
  return 'integrations';
}

function description(name) {
  const explicit = {
    ALLOW_PRIVATE_WEBHOOK_URLS: 'Permit explicitly configured private-network webhook targets in trusted local environments.',
    BRANCH_PROTECTION_TOKEN: 'Administrative GitHub token used only by the branch-protection helper.',
    ENABLE_AGENT_PATCH_APPLY: 'Allow approved local agent patches to be applied.',
    RATE_LIMIT_FAIL_OPEN: 'Allow low-risk routes to continue when shared rate-limit storage is unavailable.',
    VITE_PUBLIC_API_BASE_URL: 'Client-visible API base URL injected by Vite.',
    VITE_RUNTIME_MODE: 'Client runtime profile injected by Vite.',
    WIKIPEDIA_API_BASE: 'Wikipedia API base URL.',
    PATH: 'Operating-system executable search path; inherited rather than normally set in .env.',
    TEMP: 'Operating-system temporary directory; inherited rather than normally set in .env.',
    USERPROFILE: 'Windows user profile directory; inherited rather than normally set in .env.',
    NODE_OPTIONS: 'Node.js runtime options; inherited or supplied by CI.'
  };
  return explicit[name] ?? `${name.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase())}.`;
}

function definitionLine(name) {
  const args = `'${name}', '${category(name)}', '${description(name).replaceAll("'", "\\'")}'`;
  if (secretMarkers.some(marker => name.includes(marker))) return `  secret(${args}),`;
  if (localNames.has(name) || name.startsWith('FL_STUDIO_') || name.startsWith('PIXELORAMA_')) return `  localOnly(${args}),`;
  return `  optional(${args}),`;
}

const definitionsPath = 'src/core/config/EnvironmentDefinitions.ts';
let definitions = fs.readFileSync(definitionsPath, 'utf8');
const additions = missing.filter(name => !definitions.includes(`'${name}'`)).map(definitionLine);
if (additions.length) definitions = definitions.replace(/\n\];\n\nexport const ENVIRONMENT_DEFINITION_MAP/, `\n${additions.join('\n')}\n];\n\nexport const ENVIRONMENT_DEFINITION_MAP`);
fs.writeFileSync(definitionsPath, definitions);

const envPath = '.env.example';
let env = fs.readFileSync(envPath, 'utf8').trimEnd();
const envAdditions = missing.filter(name => !new RegExp(`^#?\\s*${name}=`, 'm').test(env));
if (envAdditions.length) {
  env += '\n\n# Extended provider, integration, CI, and inherited runtime variables\n';
  for (const name of envAdditions) env += `# ${name}=\n`;
}
fs.writeFileSync(envPath, `${env}\n`);

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
Object.assign(pkg.scripts, {
  'release:inventory': 'node scripts/release/generate-repository-inventory.mjs',
  'check:inventory': 'node scripts/release/check-repository-inventory.mjs',
  'check:reachability': 'node scripts/release/check-production-boundary.mjs',
  'check:file-size': 'node scripts/release/check-file-size.mjs',
  'check:env': 'node scripts/release/check-environment-contract.mjs',
  'check:docs': 'node scripts/release/check-docs.mjs',
  'test:release-tools': 'node --test scripts/release/__tests__/phase2-scanners.test.mjs',
  'check:phase2': 'npm run test:release-tools && npm run check:inventory && npm run check:reachability && npm run check:file-size && npm run check:env && npm run check:docs'
});
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const readmePath = 'README.md';
let readme = fs.readFileSync(readmePath, 'utf8');
readme = readme.replace('- Node.js 18 or newer.', '- Node.js 20 LTS or newer.');
readme = readme.replace('npm install\nnpm --prefix client install', 'npm ci\nnpm --prefix client ci');
readme = readme.replace("Create `.env` from the repository's environment example and supply development-safe values.", "Copy the canonical [`.env.example`](.env.example) to `.env` and supply development-safe values. Follow [Setup Prerequisites](docs/guides/SETUP_PREREQUISITES.md) for OS-specific and optional native dependencies.");
readme = readme.replace('├── docs/implementation/         # Authoritative production-completion governance', '├── config/                      # Production boundary and release configuration\n├── scripts/release/             # Reproducible inventories and Phase 2 policy checks\n├── docs/architecture/generated/ # Generated repository and reachability evidence\n├── docs/implementation/         # Authoritative production-completion governance');
fs.writeFileSync(readmePath, readme);

for (const [command, args] of [
  ['node', ['--test', 'scripts/release/__tests__/phase2-scanners.test.mjs']],
  ['node', ['scripts/release/generate-repository-inventory.mjs']],
  ['node', ['scripts/release/check-file-size.mjs', '--write-register']],
  ['node', ['scripts/release/check-environment-contract.mjs', '--write-report']],
  ['node', ['scripts/release/check-repository-inventory.mjs']],
  ['node', ['scripts/release/check-production-boundary.mjs']],
  ['node', ['scripts/release/check-file-size.mjs']],
  ['node', ['scripts/release/check-docs.mjs']]
]) execFileSync(command, args, { stdio: 'inherit' });

fs.rmSync('scripts/release/_phase2-finalize.mjs');
