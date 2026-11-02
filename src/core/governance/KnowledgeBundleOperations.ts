import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Sqlite from 'better-sqlite3';
import { z } from 'zod/v3';
import { datasetManifestSchema } from '../../types/knowledge-datasets';
import { knowledgePackSchema } from '../../types/knowledge-packs';
import { DatasetRegistry } from '../knowledge/DatasetRegistry';
import { DatasetLicensePolicy } from '../knowledge/DatasetLicensePolicy';
import { Database } from '../database/Database';

const bundleSchema = z
  .object({
    pack: knowledgePackSchema,
    datasets: z
      .array(
        z
          .object({
            manifest: datasetManifestSchema,
            version: z.string().min(1).max(160),
            documents: z
              .array(
                z
                  .object({
                    id: z.string().min(1).max(500),
                    content: z.string().trim().min(1).max(100000),
                    sourceUri: z.string().min(1),
                    title: z.string().optional(),
                  })
                  .strict()
              )
              .min(1)
              .max(10000),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export function singleFileArgument(args: string[], flag: string): string {
  if (args.length !== 2 || args[0] !== flag || !args[1])
    throw new Error(
      `Expected ${flag} <local-file>. No installation, update, or comparison was performed.`
    );
  const file = path.resolve(args[1]);
  if (!fs.statSync(file).isFile() || fs.statSync(file).size > 32 * 1024 * 1024)
    throw new Error('Input must be a local file no larger than 32 MiB.');
  return file;
}

/** Explicit local imports only. No implicit network download or provider calls. */
export async function installKnowledgeBundle(args: string[], update: boolean): Promise<unknown> {
  if (process.env.DATABASE_URL || process.env.RAG_DATABASE_URL)
    throw new Error('Knowledge bundle installation currently supports local SQLite only.');
  const bundle = bundleSchema.parse(
    JSON.parse(fs.readFileSync(singleFileArgument(args, '--bundle'), 'utf8'))
  );
  const registry = new DatasetRegistry();
  const datasetIds = new Set(bundle.datasets.map((d) => d.manifest.id));
  if (
    datasetIds.size !== bundle.datasets.length ||
    new Set(bundle.pack.datasetIds).size !== bundle.pack.datasetIds.length ||
    datasetIds.size !== bundle.pack.datasetIds.length ||
    bundle.pack.datasetIds.some((id) => !datasetIds.has(id))
  )
    throw new Error('Pack membership must match the unique bundled datasets.');
  for (const dataset of bundle.datasets) {
    const entry = registry.register(dataset.manifest);
    if (
      !entry.isLicenseRecognized ||
      !new DatasetLicensePolicy().evaluate(dataset.manifest.license).allowed
    )
      throw new Error(`License policy rejected ${dataset.manifest.id}.`);
    if (new Set(dataset.documents.map((d) => d.id)).size !== dataset.documents.length)
      throw new Error('Document IDs must be unique within a dataset.');
  }
  const dbPath = path.resolve(process.env.RAG_SQLITE_PATH || 'data/chatbot.db');
  const schema = new Database({ type: 'sqlite', filePath: dbPath });
  try {
    await schema.initialize();
  } finally {
    await schema.close();
  }
  const db = new Sqlite(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 30000');
  try {
    return db.transaction(() => {
      const existingPack = db
        .prepare('SELECT id FROM knowledge_packs WHERE id = ?')
        .get(bundle.pack.id);
      if (update && !existingPack) throw new Error('Cannot update an uninstalled pack.');
      const oldMembers = db
        .prepare('SELECT dataset_id FROM knowledge_pack_memberships WHERE pack_id = ?')
        .all(bundle.pack.id) as Array<{ dataset_id: string }>;
      if (
        existingPack &&
        (oldMembers.length !== datasetIds.size ||
          oldMembers.some((d) => !datasetIds.has(d.dataset_id)))
      )
        throw new Error('Updating pack membership requires a separate migration.');
      db.prepare(
        `INSERT INTO knowledge_packs (id, name, description, category, default_routing_domains, enabled, precedence) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, category=excluded.category,
        default_routing_domains=excluded.default_routing_domains, enabled=excluded.enabled, precedence=excluded.precedence, updated_at=CURRENT_TIMESTAMP`
      ).run(
        bundle.pack.id,
        bundle.pack.name,
        bundle.pack.description,
        bundle.pack.category,
        JSON.stringify(bundle.pack.defaultRoutingDomains),
        Number(bundle.pack.enabled),
        bundle.pack.precedence
      );
      const results = [];
      for (const { manifest: m, version, documents } of bundle.datasets) {
        const contentHash = hash(JSON.stringify({ manifest: m, documents }));
        const existing = db
          .prepare('SELECT current_version FROM knowledge_datasets WHERE id = ?')
          .get(m.id) as { current_version: string } | undefined;
        const known = db
          .prepare(
            'SELECT content_hash FROM knowledge_dataset_versions WHERE dataset_id = ? AND version = ?'
          )
          .get(m.id, version) as { content_hash: string } | undefined;
        if (known && known.content_hash !== contentHash)
          throw new Error(
            `Version ${m.id}@${version} has different content. Publish a new version.`
          );
        if (existing && existing.current_version !== version && !update)
          throw new Error(`Dataset ${m.id} is already installed; use knowledge:update.`);
        if (update && !existing) throw new Error(`Cannot update uninstalled dataset ${m.id}.`);
        if (existing?.current_version === version && known) {
          db.prepare(
            'INSERT OR IGNORE INTO knowledge_pack_memberships (pack_id, dataset_id) VALUES (?, ?)'
          ).run(bundle.pack.id, m.id);
          results.push({ id: m.id, version, status: 'unchanged' });
          continue;
        }
        db.prepare(
          `INSERT INTO knowledge_datasets (id, slug, name, provider, source_type, source_uri, license_id, license_metadata, authority_score, current_version, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, source_uri=excluded.source_uri, license_id=excluded.license_id,
          license_metadata=excluded.license_metadata, authority_score=excluded.authority_score, current_version=excluded.current_version, metadata=excluded.metadata, updated_at=CURRENT_TIMESTAMP`
        ).run(
          m.id,
          m.slug,
          m.name,
          m.provider,
          m.sourceType,
          m.sourceUri,
          m.license.id,
          JSON.stringify(m.license),
          m.authority,
          version,
          JSON.stringify({ manifest: m })
        );
        const versionId = `bundle:${hash(`${m.id}:${version}`)}`;
        db.prepare(
          `INSERT INTO knowledge_dataset_versions (id, dataset_id, version, installed_at, document_count, chunk_count, byte_size, content_hash, status)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, 'installed') ON CONFLICT(id) DO UPDATE SET status='installed'`
        ).run(
          versionId,
          m.id,
          version,
          documents.length,
          documents.length,
          Buffer.byteLength(JSON.stringify(documents)),
          contentHash
        );
        // Sources are namespaced to this installer; unrelated user sources are never removed.
        const oldSources = db
          .prepare('SELECT DISTINCT source_id FROM dataset_source_links WHERE dataset_id = ?')
          .all(m.id) as Array<{ source_id: string }>;
        for (const source of oldSources) {
          if (!source.source_id.startsWith(`bundle:${hash(m.id)}:`)) continue;
          db.prepare(
            'DELETE FROM source_citations WHERE chunk_id IN (SELECT id FROM document_chunks WHERE source_id = ?)'
          ).run(source.source_id);
          db.prepare(
            'DELETE FROM chunk_embeddings WHERE chunk_id IN (SELECT id FROM document_chunks WHERE source_id = ?)'
          ).run(source.source_id);
          db.prepare('DELETE FROM document_chunks WHERE source_id = ?').run(source.source_id);
          db.prepare('DELETE FROM dataset_source_links WHERE dataset_id = ? AND source_id = ?').run(
            m.id,
            source.source_id
          );
          db.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(source.source_id);
        }
        for (const [index, document] of documents.entries()) {
          const sourceId = `bundle:${hash(m.id)}:${hash(document.id)}`;
          const metadata = JSON.stringify({
            source: document.sourceUri,
            title: document.title || m.name,
            datasetId: m.id,
            datasetVersionId: versionId,
            version,
            license: m.license,
            authority: m.authority,
          });
          db.prepare(
            `INSERT INTO knowledge_sources (id, source, source_type, title, content_hash, metadata) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, content_hash=excluded.content_hash, metadata=excluded.metadata, updated_at=CURRENT_TIMESTAMP`
          ).run(
            sourceId,
            sourceId,
            m.sourceType,
            document.title || m.name,
            hash(document.content),
            metadata
          );
          db.prepare(
            'INSERT INTO document_chunks (id, source_id, content, chunk_index, metadata) VALUES (?, ?, ?, ?, ?)'
          ).run(`${sourceId}:chunk`, sourceId, document.content, index, metadata);
          db.prepare(
            'INSERT OR REPLACE INTO dataset_source_links (dataset_id, dataset_version_id, source_id, external_id, external_url, source_version, license_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(m.id, versionId, sourceId, document.id, document.sourceUri, version, m.license.id);
        }
        db.prepare(
          'INSERT OR IGNORE INTO knowledge_pack_memberships (pack_id, dataset_id) VALUES (?, ?)'
        ).run(bundle.pack.id, m.id);
        db.prepare(
          `INSERT INTO dataset_jobs (id, dataset_id, dataset_version_id, job_type, status, started_at, completed_at, progress_current) VALUES (?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 100)`
        ).run(crypto.randomUUID(), m.id, versionId, update ? 'update' : 'install');
        results.push({ id: m.id, version, status: 'installed', chunks: documents.length });
      }
      return { pack: bundle.pack.id, operation: update ? 'update' : 'install', datasets: results };
    })();
  } finally {
    db.close();
  }
}
