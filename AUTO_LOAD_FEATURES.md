# Auto-Load Features Guide

All features are now automatically loaded when the application starts!

## 🚀 What Auto-Loads

### On Application Start:

1. **Embedding Service** ✅
   - Initializes with configured provider (Xenova, OpenAI, or Ollama)
   - Ready for RAG document embeddings

2. **LLM Adapters** ✅
   - Ollama (free, local) - checked and registered
   - Hugging Face (free, API) - if enabled
   - OpenAI (paid) - if API key provided
   - All adapters registered with Model Router

3. **Model Router** ✅
   - All available models registered
   - Intelligent routing configured
   - Free models prioritized

4. **RAG Service** ✅
   - Initialized with embeddings
   - Knowledge base automatically loaded from `./knowledge-base/` directory
   - Documents parsed, chunked, and embedded

5. **Safety Pipeline** ✅
   - All safety mechanisms initialized
   - Ready for content validation

6. **Caching** ✅
   - Multi-level cache initialized (L1: memory, L2: Redis if enabled, L3: disk if enabled)
   - Semantic cache ready

7. **Vision Adapter** ✅
   - LLaVA (free) - if enabled
   - GPT-4V or Gemini - if API keys provided

8. **Tools** ✅
   - Code executor registered
   - Web searcher registered
   - Tool registry ready

9. **Enhanced Orchestrator** ✅
   - All features integrated
   - Ready to process requests

## 📁 Knowledge Base Auto-Load

The system automatically:

1. **Checks for `./knowledge-base/` directory**
   - Creates it if it doesn't exist
   - Adds an example file

2. **Loads all documents** on startup:
   - Parses `.txt`, `.md`, `.json`, `.pdf` files
   - Chunks documents automatically
   - Generates embeddings (if enabled)
   - Makes them searchable via RAG

3. **Logs loading progress**:
   ```
   Loading knowledge base documents...
   Knowledge base loaded successfully (5 files)
   ```

## ⚙️ Configuration

All auto-loading is controlled via `.env`:

```env
# Knowledge Base
KNOWLEDGE_BASE_DIR=./knowledge-base
RAG_GENERATE_EMBEDDINGS=true
RAG_CHUNK_SIZE=500

# Features (all enabled by default)
ENABLE_RAG=true
ENABLE_MODEL_ROUTING=true
ENABLE_SAFETY_PIPELINE=true
ENABLE_SEMANTIC_CACHE=true
ENABLE_ENSEMBLE=false

# Cache
ENABLE_REDIS_CACHE=true
REDIS_URL=redis://localhost:6379
ENABLE_DISK_CACHE=true
DISK_CACHE_DIR=./cache

# Vision
USE_LLAVA=true
LLAVA_MODEL=llava:llama3
```

## 📊 Startup Logs

When the server starts, you'll see:

```
🚀 Initializing all services...
Embedding service initialized (provider: xenova)
LLM adapters initialized (primary: ollama:llama3, available: 3)
Model router initialized (modelsCount: 9)
Loading knowledge base documents...
Knowledge base loaded successfully (5 files)
RAG service initialized
Safety pipeline initialized
Cache initialized (levels: 3)
Vision adapter initialized (type: LLaVAAdapter)
Tools initialized (toolsCount: 2)
✅ All services initialized successfully
🚀 Server running on port 3001
```

## 🔧 Manual Operations

Even though everything auto-loads, you can still:

### Add Documents via API:
```bash
POST /api/knowledge-base/add
{
  "text": "Your document content...",
  "metadata": { "source": "manual", "title": "My Doc" }
}
```

### Add Files via API:
```bash
POST /api/knowledge-base/file
{
  "filePath": "./documents/myfile.txt"
}
```

### Check Knowledge Base Stats:
```bash
GET /api/knowledge-base/stats
```

### List Available Tools:
```bash
GET /api/tools
```

### List Free Models:
```bash
GET /api/models/free
```

## 🎯 What Happens on Startup

1. **Service Initialization** (parallel where possible)
   - Embedding service
   - LLM adapters (checks availability)
   - Model router (registers all)
   - RAG service
   - Safety pipeline
   - Cache layers
   - Vision adapter
   - Tools

2. **Knowledge Base Loading**
   - Scans `KNOWLEDGE_BASE_DIR`
   - Processes all files
   - Generates embeddings
   - Indexes for retrieval

3. **Orchestrator Setup**
   - Integrates all services
   - Configures feature flags
   - Ready for requests

4. **Server Start**
   - Waits for initialization
   - Starts listening on port
   - Logs all enabled features

## 🚨 Error Handling

- If Ollama is not available, falls back to other adapters
- If knowledge base directory doesn't exist, creates it with example
- If Redis is not available, uses L1 cache only
- If vision adapter fails, continues without vision
- All errors are logged, system continues with available features

## ✨ Benefits

- **Zero manual setup** - Everything just works
- **Automatic discovery** - Finds and uses available services
- **Graceful degradation** - Works with whatever is available
- **Comprehensive logging** - See exactly what loaded
- **Production ready** - All features initialized properly

## 📝 Notes

- Knowledge base loads **synchronously** on startup (may take a few seconds)
- Large knowledge bases may take longer to load
- Embeddings are generated in the background (non-blocking)
- All services are ready before the server accepts requests

