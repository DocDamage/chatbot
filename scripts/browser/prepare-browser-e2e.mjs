import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--confirm-browser-e2e-reset')) {
  throw new Error('Refusing to reset browser E2E state without --confirm-browser-e2e-reset.');
}

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const dataRoot = join(repositoryRoot, 'data');
const fixtureRoot = join(dataRoot, 'browser-e2e-fixtures');
const cleanupTargets = [
  join(dataRoot, 'chatbot.db'),
  join(dataRoot, 'chatbot.db-shm'),
  join(dataRoot, 'chatbot.db-wal'),
  join(dataRoot, 'browser-e2e-output'),
  join(dataRoot, 'local-tool-runs', 'browser-e2e'),
  join(dataRoot, 'sprite-lab', 'browser-e2e'),
];

for (const target of cleanupTargets) {
  await rm(target, { recursive: true, force: true });
}

await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(fixtureRoot, { recursive: true });
await writeFile(
  join(fixtureRoot, 'browser-e2e-note.txt'),
  'P03-T05 built-server browser E2E fixture.\nThis file is loaded into chat context by Playwright.\n',
  'utf8',
);

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nAAAAABJRU5ErkJggg==',
  'base64',
);
await writeFile(join(fixtureRoot, 'browser-e2e-sprite.png'), onePixelPng);
await writeFile(join(fixtureRoot, 'browser-e2e-tone.wav'), createToneWav());

console.log(`Prepared isolated browser E2E fixtures in ${fixtureRoot}`);

function createToneWav() {
  const sampleRate = 8_000;
  const durationSeconds = 0.2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataLength = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataLength);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 4_000);
    buffer.writeInt16LE(sample, 44 + index * 2);
  }

  return buffer;
}
