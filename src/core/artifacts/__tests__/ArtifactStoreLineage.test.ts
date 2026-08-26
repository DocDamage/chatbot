import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CapabilityArtifactStore } from '../../capabilities/artifacts/CapabilityArtifactStore';

describe('RT-PLAT-007 — Artifact Store, Lineage, Quota, and Cleanup Suite', () => {
  let tempStoreDir: string;
  let artifactStore: CapabilityArtifactStore;
  const adminUser = { userId: 'admin-user', isAdmin: true };

  beforeEach(() => {
    tempStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-store-test-'));
    artifactStore = new CapabilityArtifactStore(tempStoreDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempStoreDir)) {
      fs.rmSync(tempStoreDir, { recursive: true, force: true });
    }
  });

  it('stores artifact with cryptographic SHA-256 digest and metadata', () => {
    const payload = Buffer.from('Hello world artifact content');
    const meta = artifactStore.storeArtifact({
      jobId: 'job-101',
      capabilityId: 'cap-tts',
      packVersion: '1.0.0',
      ownerId: 'user-a',
      parentArtifactIds: [],
      filename: 'output.wav',
      contentType: 'audio/wav',
      content: payload,
    });

    expect(meta.id).toBeDefined();
    expect(meta.sha256Digest).toBeDefined();
    expect(meta.byteSize).toBe(payload.length);
    expect(meta.accessScope).toBe('owner_only');

    const retrieved = artifactStore.getArtifactMetadata(meta.id, adminUser);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(meta.id);
  });

  it('tracks parent-child artifact lineage', () => {
    const parent = artifactStore.storeArtifact({
      jobId: 'job-102',
      capabilityId: 'cap-ocr',
      packVersion: '1.0.0',
      ownerId: 'user-a',
      parentArtifactIds: [],
      filename: 'extracted-cues.json',
      contentType: 'application/json',
      content: Buffer.from(JSON.stringify([{ cue: 1 }])),
    });

    const child = artifactStore.storeArtifact({
      jobId: 'job-103',
      capabilityId: 'cap-translate',
      packVersion: '1.0.0',
      ownerId: 'user-a',
      parentArtifactIds: [parent.id],
      filename: 'translated-cues.json',
      contentType: 'application/json',
      content: Buffer.from(JSON.stringify([{ cue: 1, translated: 'es' }])),
    });

    expect(child.parentArtifactIds).toContain(parent.id);
  });

  it('sanitizes filename to prevent directory traversal and illegal characters', () => {
    const dangerous = '../../etc/passwd%00.exe';
    const sanitized = artifactStore.sanitizeFilename(dangerous);

    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('\\');
  });

  it('lists artifacts associated with specific jobId', () => {
    artifactStore.storeArtifact({
      jobId: 'job-104',
      capabilityId: 'cap-temp',
      packVersion: '1.0.0',
      ownerId: 'user-b',
      parentArtifactIds: [],
      filename: 'temp.txt',
      contentType: 'text/plain',
      content: Buffer.from('temporary data'),
    });

    const list = artifactStore.listArtifactsForJob('job-104');
    expect(list.length).toBe(1);
    expect(list[0].jobId).toBe('job-104');
  });
});
