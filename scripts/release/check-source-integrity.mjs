import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRegisterPath = path.join(root, 'docs/implementation/CAPABILITY_SOURCE_REGISTER.md');
const provenancePath = path.join(root, 'docs/implementation/NATIVE_CANDIDATE_PROVENANCE.md');
const termsPath = path.join(root, 'docs/implementation/DEPENDENCY_AND_ASSET_TERMS_REGISTER.md');
const cleanRoomPath = path.join(root, 'docs/implementation/CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md');
const noticesPath = path.join(root, 'THIRD_PARTY_NOTICES.md');

const allowedModes = new Set([
  'NATIVE_ADAPTATION',
  'EXTERNAL_SERVICE_ADAPTER',
  'CLEAN_ROOM_IMPLEMENTATION',
  'REFERENCE_ONLY',
  'REJECTED',
  'BLOCKED',
]);

const blockedFromNative = new Set([
  'UE5 MCP Bridge',
  'Omni-Memory',
  'PageLM',
  'pdf2audio',
  'AssetCooker',
]);

const errors = [];

function fail(msg) {
  errors.push(msg);
}

function clean(value) {
  return value.trim().replace(/^`|`$/g, '');
}

export function checkSourceIntegrity() {
  if (!fs.existsSync(sourceRegisterPath)) {
    fail(`Missing source register: ${sourceRegisterPath}`);
    return { ok: false, errors };
  }
  if (!fs.existsSync(provenancePath)) {
    fail(`Missing native provenance: ${provenancePath}`);
  }
  if (!fs.existsSync(termsPath)) {
    fail(`Missing dependency & asset terms register: ${termsPath}`);
  }
  if (!fs.existsSync(cleanRoomPath)) {
    fail(`Missing clean-room protocol: ${cleanRoomPath}`);
  }
  if (!fs.existsSync(noticesPath)) {
    fail(`Missing third-party notices: ${noticesPath}`);
  }

  const content = fs.readFileSync(sourceRegisterPath, 'utf8');
  const lines = content.split(/\r?\n/);
  let parsedCount = 0;

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').slice(1, -1).map(clean);
    if (cols.length < 8) continue;
    if (cols[0].includes('---') || cols[0].toLowerCase().includes('source')) continue;

    const name = cols[0].replace(/\*\*/g, '').trim();
    const upstream = cols[1];
    const revision = cols[2];
    const license = cols[3];
    const mode = cols[5];

    parsedCount++;

    if (!upstream || upstream.length === 0) {
      fail(`${name}: Missing upstream repository`);
    }
    if (!revision || revision.length === 0) {
      fail(`${name}: Missing revision`);
    }
    if (!license || license.length === 0) {
      fail(`${name}: Missing license`);
    }

    const modes = mode.split('/').map((m) => m.trim().replace(/^`|`$/g, ''));
    for (const m of modes) {
      if (!allowedModes.has(m)) {
        fail(`${name}: Invalid integration mode '${m}'`);
      }
      if (blockedFromNative.has(name) && m === 'NATIVE_ADAPTATION') {
        fail(`${name}: Prohibited from NATIVE_ADAPTATION due to licensing/terms constraint`);
      }
    }
  }

  if (parsedCount < 25) {
    fail(`Expected at least 25 registered sources, found ${parsedCount}`);
  }

  return {
    ok: errors.length === 0,
    parsedCount,
    errors,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = checkSourceIntegrity();
  if (!result.ok) {
    console.error('Source integrity check failed:');
    for (const err of result.errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }
  console.log(`Source integrity verified for ${result.parsedCount} sources.`);
}
