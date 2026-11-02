/**
 * Context Economy Benchmark & Evaluation Suite (PX-03 / PX03-T01 & PX03-T10)
 * Evaluates token reduction, latency, and anchor/citation retention
 * across fixed corpora: code, stack traces, diffs, JSON payloads, and tables.
 */

import { ContextContentRouter } from '../router/ContextContentRouter';

export interface BenchmarkCorpusItem {
  id: string;
  name: string;
  category: string;
  rawContent: string;
  criticalAnchors: string[];
}

export interface BenchmarkItemResult {
  id: string;
  name: string;
  category: string;
  originalBytes: number;
  compressedBytes: number;
  reductionPercentage: number;
  durationMs: number;
  retainedAnchorsRate: number;
}

export interface BenchmarkSuiteResult {
  totalItems: number;
  averageReductionPercentage: number;
  overallAnchorRetentionRate: number;
  totalDurationMs: number;
  results: BenchmarkItemResult[];
}

export const FIXED_BENCHMARK_CORPUS: BenchmarkCorpusItem[] = [
  {
    id: 'code-typescript-class',
    name: 'TypeScript User Service Class',
    category: 'source_code',
    rawContent: `
import { Database } from 'better-sqlite3';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
}

export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public async findUserById(id: string): Promise<UserProfile | null> {
    const query = 'SELECT * FROM users WHERE id = ?';
    const row = this.db.prepare(query).get(id);
    if (!row) return null;
    return {
      id: row.id,
      username: row.username,
      email: row.email
    };
  }

  public async deleteUser(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  }
}
`,
    criticalAnchors: ['UserService', 'findUserById', 'deleteUser', 'UserProfile']
  },
  {
    id: 'json-api-response',
    name: 'Large Nested API Results',
    category: 'json_payload',
    rawContent: JSON.stringify({
      status: 'ok',
      count: 100,
      users: Array.from({ length: 25 }, (_, i) => ({
        id: `usr_${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        metadata: { role: 'developer', tags: ['typescript', 'node', 'react'] }
      }))
    }, null, 2),
    criticalAnchors: ['status', 'count', 'users', 'metadata']
  },
  {
    id: 'git-diff-sample',
    name: 'Git Diff with Multi-line Context',
    category: 'git_diff',
    rawContent: `
diff --git a/src/server/index.ts b/src/server/index.ts
--- a/src/server/index.ts
+++ b/src/server/index.ts
@@ -10,30 +10,32 @@
 import express from 'express';
 import cors from 'cors';
+import helmet from 'helmet';
+import { createCapabilityRouter } from './routes/capabilities';
 import path from 'path';
 import fs from 'fs';
 import { logger } from './logger';
 import { config } from './config';
 import { setupAuth } from './auth';
 import { createDatabase } from './database';
 import { registerEvents } from './events';
 import { initializeServices } from './services';
 import { metricsMiddleware } from './metrics';

 const app = express();
 app.use(cors());
+app.use(helmet());
+app.use('/api/capabilities', createCapabilityRouter());
 app.use(express.json());
 app.use(metricsMiddleware);
 app.use('/auth', setupAuth());
 app.listen(3001);
`,
    criticalAnchors: ['helmet', 'createCapabilityRouter', 'src/server/index.ts']
  },
  {
    id: 'stack-trace-sample',
    name: 'Node/Jest Error Stack Trace',
    category: 'stack_trace',
    rawContent: `
Error: Request failed with status code 404
    at createError (I:\\Coding Projects\\ChatBot\\node_modules\\axios\\lib\\core\\createError.js:16:15)
    at settle (I:\\Coding Projects\\ChatBot\\node_modules\\axios\\lib\\core\\settle.js:17:12)
    at IncomingMessage.handleStreamEnd (I:\\Coding Projects\\ChatBot\\node_modules\\axios\\lib\\adapters\\http.js:269:11)
    at IncomingMessage.emit (node:events:531:35)
    at endReadableNT (node:internal/streams/readable:1696:12)
    at process.processTicksAndRejections (node:internal/process/task_queues:82:21)
    at UserService.findUserById (I:\\Coding Projects\\ChatBot\\src\\core\\user\\UserService.ts:25:12)
`,
    criticalAnchors: ['Error: Request failed with status code 404', 'UserService.ts']
  }
];

export class ContextBenchmarkSuite {
  private router = ContextContentRouter.getInstance();

  public async runBenchmark(corpus: BenchmarkCorpusItem[] = FIXED_BENCHMARK_CORPUS): Promise<BenchmarkSuiteResult> {
    const startTime = Date.now();
    const results: BenchmarkItemResult[] = [];
    let totalReductions = 0;
    let totalRetentionRate = 0;

    for (const item of corpus) {
      const itemStart = Date.now();
      const res = this.router.routeAndCompress({
        text: item.rawContent,
        ownerId: 'benchmark-runner',
        storeOriginal: true
      });
      const durationMs = Date.now() - itemStart;

      const origBytes = Buffer.from(item.rawContent).length;
      const compBytes = Buffer.from(res.compressedText).length;
      const reduction = Math.max(0, ((origBytes - compBytes) / origBytes) * 100);

      let retainedCount = 0;
      for (const anchor of item.criticalAnchors) {
        if (res.compressedText.includes(anchor)) {
          retainedCount++;
        }
      }
      const retentionRate = item.criticalAnchors.length > 0 ? retainedCount / item.criticalAnchors.length : 1;

      totalReductions += reduction;
      totalRetentionRate += retentionRate;

      results.push({
        id: item.id,
        name: item.name,
        category: item.category,
        originalBytes: origBytes,
        compressedBytes: compBytes,
        reductionPercentage: Math.round(reduction * 10) / 10,
        durationMs,
        retainedAnchorsRate: retentionRate
      });
    }

    const totalDurationMs = Date.now() - startTime;
    return {
      totalItems: corpus.length,
      averageReductionPercentage: Math.round((totalReductions / corpus.length) * 10) / 10,
      overallAnchorRetentionRate: Math.round((totalRetentionRate / corpus.length) * 100) / 100,
      totalDurationMs,
      results
    };
  }
}
