import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Database } from '../src/core/database/Database';
import { EmbeddingService } from '../src/core/embeddings/EmbeddingService';
import { DocumentIngester } from '../src/core/rag/DocumentIngester';
import { RAGDocumentStore } from '../src/core/rag/RAGDocumentStore';
import { FileTypeRouter } from '../src/core/rag/ingestion/FileTypeRouter';
import { DocumentChunk } from '../src/types/rag';

type EmbeddingProvider = 'openai' | 'xenova' | 'ollama';

process.on('unhandledRejection', reason => {
  const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  console.warn(`[parser warning] Unhandled async parser rejection ignored during book import: ${message}`);
});

interface ImportArgs {
  booksDir: string;
  chunkSize: number;
  chunkOverlap: number;
  embeddingBatchSize: number;
  generateEmbeddings: boolean;
  embeddingProvider: EmbeddingProvider;
  embeddingModel?: string;
  collection: string;
  visibility: string;
  sourceType: string;
  dryRun: boolean;
  skipExisting: boolean;
  limit?: number;
  extensions?: Set<string>;
}

const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  '.next',
  'build',
  '.worktrees'
]);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const router = new FileTypeRouter();
  const supportedExtensions = new Set(
    (args.extensions || new Set(router.getSupportedExtensions()))
      .values()
  );
  const booksDir = path.resolve(args.booksDir);

  if (!fs.existsSync(booksDir) || !fs.statSync(booksDir).isDirectory()) {
    throw new Error(`Books directory not found: ${booksDir}`);
  }

  const files = listBookFiles(booksDir, supportedExtensions).slice(0, args.limit);
  if (files.length === 0) {
    console.log(`No supported book files found in ${booksDir}`);
    console.log(`Supported extensions: ${Array.from(supportedExtensions).sort().join(', ')}`);
    return;
  }

  console.log(`Book import starting`);
  console.log(`Directory: ${booksDir}`);
  console.log(`Files: ${files.length}`);
  console.log(`Embeddings: ${args.generateEmbeddings ? `${args.embeddingProvider}${args.embeddingModel ? `/${args.embeddingModel}` : ''}` : 'off'}`);
  console.log(`Persistence: ${args.dryRun ? 'dry run only' : 'RAG document store'}`);

  const database = args.dryRun ? undefined : createDatabase();
  if (database) {
    await database.initialize();
  }

  const store = database ? new RAGDocumentStore(database) : undefined;
  const embeddingService = args.generateEmbeddings
    ? new EmbeddingService(
        process.env.OPENAI_API_KEY,
        process.env.OLLAMA_URL || 'http://localhost:11434',
        args.embeddingProvider,
        args.embeddingModel || process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
      )
    : undefined;
  const ingester = new DocumentIngester(embeddingService, router);

  let imported = 0;
  let skippedExisting = 0;
  let chunksImported = 0;
  const failures: Array<{ file: string; error: string }> = [];

  try {
    for (let index = 0; index < files.length; index++) {
      const filePath = files[index];
      const relativePath = path.relative(booksDir, filePath);

      if (args.skipExisting && store && await store.hasSource(filePath)) {
        skippedExisting++;
        console.log(`[${index + 1}/${files.length}] skipped existing ${relativePath}`);
        continue;
      }

      try {
        const chunks = await ingester.ingestFile(filePath, {
          chunkSize: args.chunkSize,
          chunkOverlap: args.chunkOverlap,
          generateEmbeddings: args.generateEmbeddings,
          embeddingProvider: args.embeddingProvider,
          embeddingModel: args.embeddingModel,
          embeddingBatchSize: args.embeddingBatchSize
        });
        const enrichedChunks = enrichBookChunks(chunks, {
          collection: args.collection,
          visibility: args.visibility,
          relativePath,
          booksDir
        });

        if (!args.dryRun && store) {
          await store.saveChunks(enrichedChunks, {
            sourceType: args.sourceType,
            embeddingProvider: args.generateEmbeddings ? args.embeddingProvider : undefined,
            embeddingModel: args.generateEmbeddings ? args.embeddingModel : undefined
          });
        }

        imported++;
        chunksImported += enrichedChunks.length;
        const warningCount = enrichedChunks[0]?.metadata.extractionWarnings?.length || 0;
        console.log(`[${index + 1}/${files.length}] imported ${relativePath} (${enrichedChunks.length} chunks${warningCount ? `, ${warningCount} warnings` : ''})`);
      } catch (error: any) {
        failures.push({ file: relativePath, error: error.message });
        console.warn(`[${index + 1}/${files.length}] failed ${relativePath}: ${error.message}`);
      }
    }
  } finally {
    if (database) {
      await database.close();
    }
  }

  console.log(`Book import complete`);
  console.log(`Imported files: ${imported}`);
  console.log(`Skipped existing: ${skippedExisting}`);
  console.log(`Chunks: ${chunksImported}`);
  console.log(`Failures: ${failures.length}`);
  if (!args.dryRun) {
    console.log(`Tip: set RAG_RETRIEVAL_MODE=database or hybrid so the running chatbot queries these persisted books directly.`);
  }

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 10)) {
      console.warn(`- ${failure.file}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): ImportArgs {
  const args: ImportArgs = {
    booksDir: process.env.BOOKS_DIR || './books',
    chunkSize: parsePositiveInt(process.env.BOOKS_CHUNK_SIZE || process.env.RAG_CHUNK_SIZE, 900),
    chunkOverlap: parsePositiveInt(process.env.BOOKS_CHUNK_OVERLAP, 120),
    embeddingBatchSize: parsePositiveInt(process.env.BOOKS_EMBEDDING_BATCH_SIZE || process.env.RAG_EMBEDDING_BATCH_SIZE, 16),
    generateEmbeddings: process.env.BOOKS_GENERATE_EMBEDDINGS !== 'false' && process.env.RAG_GENERATE_EMBEDDINGS !== 'false',
    embeddingProvider: parseEmbeddingProvider(process.env.EMBEDDING_PROVIDER || 'xenova'),
    embeddingModel: process.env.EMBEDDING_MODEL,
    collection: process.env.BOOKS_COLLECTION || 'books',
    visibility: process.env.BOOKS_VISIBILITY || 'private',
    sourceType: process.env.BOOKS_SOURCE_TYPE || 'book',
    dryRun: false,
    skipExisting: true
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split('=', 2);
    const nextValue = () => inlineValue ?? argv[++index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      args.booksDir = arg;
    } else if (flag === '--dir' || flag === '--books-dir') {
      args.booksDir = nextValue();
    } else if (flag === '--chunk-size') {
      args.chunkSize = parsePositiveInt(nextValue(), args.chunkSize);
    } else if (flag === '--chunk-overlap') {
      args.chunkOverlap = parsePositiveInt(nextValue(), args.chunkOverlap);
    } else if (flag === '--embedding-batch-size') {
      args.embeddingBatchSize = parsePositiveInt(nextValue(), args.embeddingBatchSize);
    } else if (arg === '--no-embeddings') {
      args.generateEmbeddings = false;
    } else if (flag === '--embeddings') {
      args.generateEmbeddings = nextValue() !== 'false';
    } else if (flag === '--provider') {
      args.embeddingProvider = parseEmbeddingProvider(nextValue());
    } else if (flag === '--model') {
      args.embeddingModel = nextValue();
    } else if (flag === '--collection') {
      args.collection = nextValue();
    } else if (flag === '--visibility') {
      args.visibility = nextValue();
    } else if (flag === '--source-type') {
      args.sourceType = nextValue();
    } else if (flag === '--limit') {
      args.limit = parsePositiveInt(nextValue(), 0) || undefined;
    } else if (flag === '--ext' || flag === '--extensions') {
      args.extensions = new Set(nextValue().split(',').map(normalizeExtension).filter(Boolean));
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--no-skip-existing') {
      args.skipExisting = false;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`Usage: npm run import:books -- <books-dir> [options]

Options:
  --chunk-size <n>              Approximate chunk size in characters (default: 900)
  --chunk-overlap <n>           Approximate overlap between chunks (default: 120)
  --embedding-batch-size <n>    Embedding concurrency batch size (default: 16)
  --no-embeddings              Store chunks without vector embeddings
  --provider <xenova|openai|ollama>
  --model <name>
  --ext <.pdf,.epub,.txt>       Limit imported extensions
  --collection <name>           Metadata collection name (default: books)
  --visibility <value>          Metadata visibility (default: private)
  --limit <n>                   Import only the first n files
  --dry-run                     Parse and chunk without writing to the database
  --no-skip-existing            Re-import sources already present in the store
`);
}

function createDatabase(): Database {
  const connectionString = process.env.RAG_DATABASE_URL || process.env.DATABASE_URL;
  return connectionString
    ? new Database({ type: 'postgresql', connectionString })
    : new Database({
        type: 'sqlite',
        filePath: process.env.RAG_SQLITE_PATH || path.join(process.cwd(), 'data', 'chatbot.db')
      });
}

function listBookFiles(directoryPath: string, extensions: Set<string>): string[] {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...listBookFiles(entryPath, extensions));
      }
    } else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.resolve(entryPath));
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function enrichBookChunks(
  chunks: DocumentChunk[],
  metadata: {
    collection: string;
    visibility: string;
    relativePath: string;
    booksDir: string;
  }
): DocumentChunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      collection: metadata.collection,
      visibility: metadata.visibility,
      sourceCategory: 'book',
      relativePath: metadata.relativePath,
      importRoot: metadata.booksDir,
      importedBy: 'scripts/import-books.ts'
    }
  }));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function parseEmbeddingProvider(value: string): EmbeddingProvider {
  if (value === 'openai' || value === 'xenova' || value === 'ollama') {
    return value;
  }
  return 'xenova';
}

main().catch((error: any) => {
  console.error(error.message);
  process.exit(1);
});
