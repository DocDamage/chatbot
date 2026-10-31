import { spawn } from 'child_process';
import path from 'path';
import { CanonicalCliCommandName, CliExecutionContext } from '../../types/cli-scripts';
import { datasetManifestSchema } from '../../types/knowledge-datasets';
import { DatasetRegistry } from '../knowledge/DatasetRegistry';
import { DatasetLicensePolicy } from '../knowledge/DatasetLicensePolicy';

export interface CommandOutput { success: boolean; stdout: string; stderr?: string; exitCode?: number }
export interface CanonicalOperations { run(name: CanonicalCliCommandName, context: CliExecutionContext): Promise<CommandOutput> }

const verification: Partial<Record<CanonicalCliCommandName, string>> = {
  'chat:runtime:smoke': 'src/core/chat/(ChatRuntime|DailyChatService).*test.ts',
  'chat:runtime:golden': 'src/core/evals/__tests__/golden-regression-suite.test.ts',
  'eval:chat': 'src/core/evals/__tests__/golden-regression-suite.test.ts',
  'eval:retrieval': 'src/core/knowledge/__tests__/(coding-retrieval-policy|general-retrieval-policy|knowledge-router).test.ts',
  'eval:tool-truth': 'src/core/tools/__tests__/tool-truthfulness-failure.test.ts',
  'eval:datasets': 'src/core/knowledge/__tests__/DatasetLoader.test.ts',
  'check:chat-runtime': 'src/core/chat/.*test.ts|src/core/state/.*test.ts',
};

/** Real offline tests and read-only local database inspection. Never infer success from registration. */
export class CanonicalCommandOperations implements CanonicalOperations {
  async run(name: CanonicalCliCommandName, context: CliExecutionContext): Promise<CommandOutput> {
    const pattern = verification[name];
    if (pattern) return this.runTests(name, pattern);
    if (['knowledge:install', 'knowledge:update', 'chat:runtime:shadow-report'].includes(name)) {
      return { success: false, exitCode: 2, stdout: '', stderr: `${name} is not connected to an operational handler. No installation, update, or shadow comparison was performed.` };
    }
    if (context.args.length > 0) return { success: false, exitCode: 2, stdout: '', stderr: `${name} does not accept arguments.` };
    if (process.env.DATABASE_URL || process.env.RAG_DATABASE_URL) {
      return { success: false, stdout: '', stderr: 'These inspection commands currently support local SQLite only; the PostgreSQL database was not checked.' };
    }
    const Sqlite = require('better-sqlite3');
    const database = new Sqlite(path.resolve(process.env.RAG_SQLITE_PATH || 'data/chatbot.db'), { readonly: true, fileMustExist: true });
    try {
      const datasets = database.prepare('SELECT id, slug, name, current_version, source_uri, license_id, metadata FROM knowledge_datasets ORDER BY id').all();
      let result: unknown;
      if (name === 'knowledge:list') {
        result = { datasets, packs: database.prepare('SELECT id, name, enabled FROM knowledge_packs ORDER BY id').all() };
      } else if (name === 'knowledge:stats') {
        result = Object.fromEntries(['knowledge_sources', 'document_chunks', 'chunk_embeddings', 'knowledge_datasets'].map(table => [table, database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
      } else if (name === 'knowledge:verify') {
        const integrity = database.pragma('quick_check');
        const foreignKeys = database.pragma('foreign_key_check');
        const success = integrity.every((row: any) => row.quick_check === 'ok') && foreignKeys.length === 0;
        return { success, stdout: JSON.stringify({ scope: 'SQLite integrity and foreign keys', integrity, foreignKeys }, null, 2) };
      } else {
        if (datasets.length === 0) return { success: false, stdout: '', stderr: 'No registered dataset manifests are installed. No dataset compliance claim can be made.' };
        const failures: string[] = [];
        for (const dataset of datasets) {
          const metadata = typeof dataset.metadata === 'string' ? JSON.parse(dataset.metadata) : dataset.metadata;
          if (name === 'knowledge:verify-manifests') {
            const parsed = datasetManifestSchema.safeParse(metadata?.manifest);
            if (!parsed.success) failures.push(`${dataset.id}: persisted manifest is absent or invalid`);
          } else if (name === 'check:knowledge-licenses') {
            const parsed = datasetManifestSchema.safeParse(metadata?.manifest);
            if (!parsed.success) failures.push(`${dataset.id}: license cannot be checked without a valid persisted manifest`);
            else {
              const entry = new DatasetRegistry().register(parsed.data);
              const policy = new DatasetLicensePolicy().evaluate(parsed.data.license);
              if (!entry.isLicenseRecognized || !policy.allowed || dataset.license_id !== parsed.data.license.id) failures.push(`${dataset.id}: license is unknown, restricted, or inconsistent with the manifest`);
            }
          } else if (name === 'check:knowledge-provenance') {
            if (!dataset.source_uri || !dataset.current_version) failures.push(`${dataset.id}: source URI or version is missing`);
          } else throw new Error(`No operational handler for ${name}`);
        }
        return { success: failures.length === 0, stdout: JSON.stringify({ checkedDatasets: datasets.length, failures }, null, 2) };
      }
      return { success: true, stdout: JSON.stringify(result, null, 2) };
    } finally { database.close(); }
  }

  private runTests(name: string, pattern: string): Promise<CommandOutput> {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [require.resolve('jest/bin/jest'), '--runInBand', '--testPathPattern', pattern], { cwd: process.cwd(), windowsHide: true, shell: false });
      let stdout = `Offline verification for ${name}\n`;
      let stderr = '';
      child.stdout.on('data', data => { stdout = (stdout + data.toString()).slice(-2000000); });
      child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-2000000); });
      child.once('error', error => resolve({ success: false, stdout, stderr: error.message }));
      child.once('close', code => resolve({ success: code === 0, exitCode: code ?? 1, stdout, stderr }));
    });
  }
}
