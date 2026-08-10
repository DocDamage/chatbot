import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Database } from '../src/core/database/Database';
import { EmbeddingService } from '../src/core/embeddings/EmbeddingService';
import { DocumentIngester } from '../src/core/rag/DocumentIngester';
import { RAGDocumentStore, KnowledgeSourceRecord } from '../src/core/rag/RAGDocumentStore';
import { FileTypeRouter } from '../src/core/rag/ingestion/FileTypeRouter';
import { DocumentChunk } from '../src/types/rag';

type EmbeddingProvider = 'openai' | 'xenova' | 'ollama';

interface Args {
  limit: number;
  offset: number;
  q?: string;
  json: boolean;
  reimport: boolean;
  generateEmbeddings: boolean;
  embeddingProvider: EmbeddingProvider;
  embeddingModel?: string;
  embeddingBatchSize: number;
  maxPages: number;
  dpi: number;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const database = createDatabase();
  await database.initialize();

  try {
    const store = new RAGDocumentStore(database);
    const queue = await store.getOcrQueue({
      limit: args.limit,
      offset: args.offset,
      q: args.q,
      scanLimit: 50000
    });

    if (args.json) {
      console.log(JSON.stringify(queue, null, 2));
    } else {
      printQueue(queue.sources, queue.total, args);
    }

    if (args.reimport) {
      await reimportQueue(store, queue.sources, args);
    }
  } finally {
    await database.close();
  }
}

async function reimportQueue(
  store: RAGDocumentStore,
  sources: KnowledgeSourceRecord[],
  args: Args
): Promise<void> {
  const embeddingService = args.generateEmbeddings
    ? new EmbeddingService(
        process.env.OPENAI_API_KEY,
        process.env.OLLAMA_URL || 'http://localhost:11434',
        args.embeddingProvider,
        args.embeddingModel || process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
      )
    : undefined;

  const ingester = new DocumentIngester(embeddingService, new FileTypeRouter());
  let repaired = 0;
  let blocked = 0;
  let failed = 0;

  for (const source of sources) {
    if (!fs.existsSync(source.source)) {
      failed++;
      console.warn(`missing source file: ${source.source}`);
      continue;
    }

    try {
      const chunks = await ingester.ingestFile(source.source, {
        enablePdfOcr: true,
        pdfOcrMaxPages: args.maxPages,
        pdfOcrDpi: args.dpi,
        imageOcrLanguage: process.env.PDF_OCR_LANGUAGE || 'eng',
        chunkSize: parsePositiveInt(process.env.BOOKS_CHUNK_SIZE || process.env.RAG_CHUNK_SIZE, 900),
        chunkOverlap: parsePositiveInt(process.env.BOOKS_CHUNK_OVERLAP, 120),
        generateEmbeddings: args.generateEmbeddings,
        embeddingProvider: args.embeddingProvider,
        embeddingModel: args.embeddingModel,
        embeddingBatchSize: args.embeddingBatchSize
      });
      const enriched = enrichReimportedChunks(chunks, source);

      if (enriched[0]?.metadata.emptyExtraction || enriched[0]?.metadata.needsOcr) {
        blocked++;
        console.warn(`blocked OCR reimport: ${source.citationLabel}`);
        continue;
      }

      await store.saveChunks(enriched, {
        sourceType: source.sourceType || 'book',
        embeddingProvider: args.generateEmbeddings ? args.embeddingProvider : undefined,
        embeddingModel: args.generateEmbeddings ? args.embeddingModel : undefined
      });
      repaired++;
      console.log(`reimported with OCR: ${source.citationLabel} (${enriched.length} chunks)`);
    } catch (error: any) {
      failed++;
      console.warn(`failed OCR reimport: ${source.source}: ${error.message}`);
    }
  }

  console.log(`OCR reimport complete`);
  console.log(`Repaired: ${repaired}`);
  console.log(`Blocked: ${blocked}`);
  console.log(`Failed: ${failed}`);
}

function enrichReimportedChunks(chunks: DocumentChunk[], source: KnowledgeSourceRecord): DocumentChunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    metadata: {
      ...source.metadata,
      ...chunk.metadata,
      collection: source.metadata.collection || 'books',
      visibility: source.metadata.visibility || 'private',
      sourceCategory: source.metadata.sourceCategory || 'book',
      ocrReimportedAt: new Date().toISOString(),
      ocrReimportedBy: 'scripts/ocr-queue.ts'
    }
  }));
}

function printQueue(sources: KnowledgeSourceRecord[], total: number, args: Args): void {
  console.log(`OCR queue: ${sources.length} of ${total} sources`);
  console.log(`Limit: ${args.limit}, offset: ${args.offset}`);

  if (sources.length === 0) {
    console.log('No queued OCR candidates found.');
    return;
  }

  for (const source of sources) {
    const warning = source.warnings[0] ? ` - ${source.warnings[0]}` : '';
    console.log(`- ${source.citationLabel} (${source.fileExtension || source.sourceType || 'file'}, ${source.chunks} chunks)${warning}`);
    console.log(`  ${source.source}`);
  }
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: parsePositiveInt(process.env.OCR_QUEUE_LIMIT, 100),
    offset: 0,
    json: false,
    reimport: false,
    generateEmbeddings: process.env.OCR_REIMPORT_EMBEDDINGS !== 'false',
    embeddingProvider: parseEmbeddingProvider(process.env.EMBEDDING_PROVIDER || 'xenova'),
    embeddingModel: process.env.EMBEDDING_MODEL,
    embeddingBatchSize: parsePositiveInt(process.env.BOOKS_EMBEDDING_BATCH_SIZE || process.env.RAG_EMBEDDING_BATCH_SIZE, 16),
    maxPages: parsePositiveInt(process.env.PDF_OCR_MAX_PAGES, 25),
    dpi: parsePositiveInt(process.env.PDF_OCR_DPI, 180)
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const [flag, inlineValue] = arg.split('=', 2);
    const nextValue = () => inlineValue ?? argv[++index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg === '--reimport') {
      args.reimport = true;
    } else if (arg === '--no-embeddings') {
      args.generateEmbeddings = false;
    } else if (flag === '--limit') {
      args.limit = parsePositiveInt(nextValue(), args.limit);
    } else if (flag === '--offset') {
      args.offset = parsePositiveInt(nextValue(), args.offset);
    } else if (flag === '--q') {
      args.q = nextValue();
    } else if (flag === '--provider') {
      args.embeddingProvider = parseEmbeddingProvider(nextValue());
    } else if (flag === '--model') {
      args.embeddingModel = nextValue();
    } else if (flag === '--embedding-batch-size') {
      args.embeddingBatchSize = parsePositiveInt(nextValue(), args.embeddingBatchSize);
    } else if (flag === '--max-pages') {
      args.maxPages = parsePositiveInt(nextValue(), args.maxPages);
    } else if (flag === '--dpi') {
      args.dpi = parsePositiveInt(nextValue(), args.dpi);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`Usage: npm run kb:ocr-queue -- [options]

Options:
  --json                       Print queue as JSON
  --q <text>                   Filter queued source title/path
  --limit <n>                  Number of queued sources to return
  --offset <n>                 Queue offset
  --reimport                   Attempt OCR reimport for queued PDFs
  --max-pages <n>              OCR only first n pages per PDF
  --dpi <n>                    Rasterization DPI
  --no-embeddings              Reimport OCR text without embeddings
  --provider <xenova|openai|ollama>
  --model <name>
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

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function parseEmbeddingProvider(value: string | undefined): EmbeddingProvider {
  if (value === 'openai' || value === 'xenova' || value === 'ollama') {
    return value;
  }
  return 'xenova';
}

main().catch((error: any) => {
  console.error(error.message);
  process.exit(1);
});
