# Integration Examples - Complete Feature Usage

This document shows how to use all the newly implemented features.

## 1. Embedding Service & Dense Vector Search

```typescript
import { EmbeddingService } from './core/embeddings/EmbeddingService';

// Initialize with OpenAI (requires API key)
const embeddingService = new EmbeddingService(
  process.env.OPENAI_API_KEY,
  undefined, // ollamaUrl
  'openai', // provider
  'text-embedding-3-small' // model
);

// Or use Xenova (local, free, no API key needed)
const embeddingService = new EmbeddingService(
  undefined, // no OpenAI key
  undefined, // no Ollama
  'xenova', // provider
  'Xenova/all-MiniLM-L6-v2' // model
);

// Generate embeddings
const embedding = await embeddingService.embed('Hello, world!');
const batchEmbeddings = await embeddingService.embedBatch(['text1', 'text2', 'text3']);
```

## 2. RAG Document Management

```typescript
import { RAGService } from './core/rag/RAGService';
import { DocumentManager } from './core/rag/DocumentManager';
import { EmbeddingService } from './core/embeddings/EmbeddingService';
import { LLMAdapter } from './core/providers/LLMAdapter';

// Initialize services
const embeddingService = new EmbeddingService(undefined, undefined, 'xenova');
const ragService = new RAGService(llmAdapter, embeddingService);
const docManager = new DocumentManager(ragService, embeddingService);

// Add a single file
await docManager.addFile('./documents/knowledge-base.txt', {
  generateEmbeddings: true,
  chunkSize: 500
});

// Add text directly
await docManager.addText(
  'This is important information about AI...',
  { source: 'manual', title: 'AI Notes' },
  { generateEmbeddings: true }
);

// Add entire directory
await docManager.addDirectory('./documents/', {
  generateEmbeddings: true
});

// Query the knowledge base
const result = await ragService.processQuery('What is artificial intelligence?');
console.log(result.response);
console.log(result.citations);
```

## 3. Vision Models

```typescript
import { GPT4VAdapter } from './core/providers/VisionAdapter';
import { GeminiVisionAdapter } from './core/providers/VisionAdapter';

// GPT-4V
const gpt4v = new GPT4VAdapter(process.env.OPENAI_API_KEY!);
const result = await gpt4v.analyzeImage({
  image: base64Image,
  prompt: 'What is in this image?'
});

// Gemini Vision
const gemini = new GeminiVisionAdapter(process.env.GEMINI_API_KEY!);
const result2 = await gemini.analyzeImage({
  image: base64Image,
  prompt: 'Describe this image in detail'
});

// Multi-image analysis
const multiResult = await gpt4v.analyzeMultiImage({
  images: [image1, image2, image3],
  prompt: 'Compare these images',
  comparisonType: 'similarity'
});

// OCR
const text = await gpt4v.extractText(base64Image);
```

## 4. Multi-Level Cache

```typescript
import { MultiLevelCache } from './core/cache/MultiLevelCache';
import { RedisCache } from './core/cache/RedisCache';
import { DiskCache } from './core/cache/DiskCache';

// Initialize multi-level cache (L1: memory, L2: Redis, L3: disk)
const cache = new MultiLevelCache<ChatResponse>(
  'redis://localhost:6379', // Redis URL (optional)
  './cache' // Disk cache directory (optional)
);

// Use as normal cache
const cached = await cache.get('query-key');
if (!cached) {
  const response = await generateResponse();
  await cache.set('query-key', response, 3600); // TTL in seconds
}

// Or use individual levels
const redisCache = new RedisCache('redis://localhost:6379');
await redisCache.initialize();
await redisCache.set('key', { data: 'value' }, 3600);
const value = await redisCache.get('key');

const diskCache = new DiskCache('./cache');
await diskCache.set('key', { data: 'value' }, 3600);
const value2 = await diskCache.get('key');
await diskCache.cleanExpired(); // Clean old entries
```

## 5. Improved Tools

### Code Executor

```typescript
import { CodeExecutor } from './core/tools/CodeExecutor';
import { ToolRegistry } from './core/tools/ToolRegistry';

const executor = new CodeExecutor(5000, ['python', 'javascript', 'bash']);
const registry = new ToolRegistry();

// Register code executor tool
registry.register(executor.createTool());

// Execute code
const result = await executor.execute('print("Hello, World!")', 'python');
console.log(result.data?.output);
```

### Web Searcher

```typescript
import { WebSearcher } from './core/tools/WebSearcher';
import { ToolRegistry } from './core/tools/ToolRegistry';

// DuckDuckGo (no API key needed)
const searcher = new WebSearcher(undefined, 'duckduckgo');
const registry = new ToolRegistry();

registry.register(searcher.createTool());

// Search
const result = await searcher.search('latest AI news', 5);
console.log(result.data?.results);
```

## 6. Complete Integration Example

```typescript
import { EnhancedOrchestrator } from './core/orchestrator/EnhancedOrchestrator';
import { RAGService } from './core/rag/RAGService';
import { DocumentManager } from './core/rag/DocumentManager';
import { EmbeddingService } from './core/embeddings/EmbeddingService';
import { MultiLevelCache } from './core/cache/MultiLevelCache';
import { OpenAIAdapter } from './core/providers/LLMAdapter';

// Initialize all services
const llmAdapter = new OpenAIAdapter(process.env.OPENAI_API_KEY!);
const embeddingService = new EmbeddingService(process.env.OPENAI_API_KEY, undefined, 'openai');
const ragService = new RAGService(llmAdapter, embeddingService);
const docManager = new DocumentManager(ragService, embeddingService);
const cache = new MultiLevelCache('redis://localhost:6379', './cache');

// Add documents to knowledge base
await docManager.addDirectory('./knowledge-base/', {
  generateEmbeddings: true,
  chunkSize: 500
});

// Create enhanced orchestrator
const orchestrator = new EnhancedOrchestrator(
  llmAdapter,
  undefined, // imageAdapter
  {
    useRAG: true,
    useModelRouting: true,
    useSafetyPipeline: true,
    useSemanticCache: true,
    ragService: ragService
  }
);

// Process request
const response = await orchestrator.processRequest({
  message: 'What is machine learning?',
  sessionId: 'session-123'
});
```

## 7. Environment Configuration

Add to your `.env` file:

```env
# Embeddings
EMBEDDING_PROVIDER=xenova
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2

# Or use OpenAI
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small

# Multi-Level Cache
REDIS_URL=redis://localhost:6379
DISK_CACHE_DIR=./cache
ENABLE_REDIS_CACHE=true
ENABLE_DISK_CACHE=true

# Vision
GEMINI_API_KEY=your_gemini_api_key
USE_GEMINI_VISION=false
```

## 8. Server Integration

Update `src/server/index.ts` to use all features:

```typescript
import { EmbeddingService } from './core/embeddings/EmbeddingService';
import { RAGService } from './core/rag/RAGService';
import { DocumentManager } from './core/rag/DocumentManager';
import { MultiLevelCache } from './core/cache/MultiLevelCache';

// Initialize embedding service
const embeddingService = new EmbeddingService(
  process.env.OPENAI_API_KEY,
  process.env.OLLAMA_URL,
  (process.env.EMBEDDING_PROVIDER as any) || 'xenova',
  process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
);

// Initialize RAG with embeddings
const ragService = new RAGService(llmAdapter, embeddingService);

// Initialize multi-level cache
const cache = new MultiLevelCache(
  process.env.REDIS_URL,
  process.env.DISK_CACHE_DIR || './cache'
);

// Create document manager
const docManager = new DocumentManager(ragService, embeddingService);

// Load knowledge base on startup
if (process.env.KNOWLEDGE_BASE_DIR) {
  docManager.addDirectory(process.env.KNOWLEDGE_BASE_DIR, {
    generateEmbeddings: true
  });
}

// Use in orchestrator
const orchestrator = new EnhancedOrchestrator(llmAdapter, imageAdapter, {
  useRAG: true,
  useModelRouting: true,
  useSafetyPipeline: true,
  useSemanticCache: true,
  ragService: ragService
});
```

## Next Steps

1. Install dependencies: `npm install`
2. Set up Redis (optional): `docker run -d -p 6379:6379 redis`
3. Create knowledge base directory: `mkdir -p knowledge-base`
4. Add documents to `knowledge-base/` directory
5. Configure `.env` with your API keys
6. Start the server: `npm run dev`

All features are now fully functional!

