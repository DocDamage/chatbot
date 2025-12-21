# Datasets & Intelligence Enhancements

## 🧠 New Intelligence Features

### 1. External Knowledge Sources ✅

#### Wikipedia Integration
- **File**: `src/core/knowledge/WikipediaSource.ts`
- **Features**:
  - Search Wikipedia articles
  - Fetch page summaries
  - Extract structured information
  - Automatic availability checking

**Usage**:
```bash
POST /api/knowledge/wikipedia
{
  "query": "artificial intelligence",
  "limit": 5
}
```

#### Web Scraper
- **File**: `src/core/knowledge/WebScraperSource.ts`
- **Features**:
  - Scrape web pages for knowledge
  - Domain whitelisting
  - Content extraction
  - Automatic cleaning

**Usage**:
```bash
POST /api/knowledge/scrape
{
  "urls": ["https://example.com/article"],
  "allowedDomains": ["example.com"]
}
```

### 2. Dataset Loaders ✅

#### CSV Loader
- **File**: `src/core/knowledge/DatasetLoader.ts`
- **Features**:
  - Load CSV files
  - Automatic chunking
  - Header detection
  - Custom delimiters

**Usage**:
```bash
POST /api/knowledge/load-csv
{
  "filePath": "./data/dataset.csv",
  "generateEmbeddings": true,
  "chunkSize": 10
}
```

#### JSON Loader
- **Features**:
  - Load JSON arrays or objects
  - Automatic formatting
  - Chunking support

**Usage**:
```bash
POST /api/knowledge/load-json
{
  "filePath": "./data/dataset.json",
  "generateEmbeddings": true
}
```

#### SQLite Loader
- **Features**:
  - Load from SQLite databases
  - Table selection
  - Row chunking

**Usage**:
```bash
POST /api/knowledge/load-sqlite
{
  "dbPath": "./data/knowledge.db",
  "tableName": "facts",
  "generateEmbeddings": true
}
```

### 3. Knowledge Graph ✅

- **File**: `src/core/knowledge/KnowledgeGraph.ts`
- **Features**:
  - Entity tracking
  - Relationship mapping
  - Graph queries
  - Related entity discovery
  - LLM-based extraction

**Usage**:
```bash
# Add entity
POST /api/knowledge/graph/entity
{
  "id": "e1",
  "name": "Albert Einstein",
  "type": "Person",
  "properties": {"born": "1879", "field": "Physics"}
}

# Query graph
GET /api/knowledge/graph/query?entityName=Einstein&limit=10
```

### 4. Knowledge Fusion ✅

- **File**: `src/core/knowledge/KnowledgeFusion.ts`
- **Features**:
  - Combine multiple sources
  - Deduplication
  - Confidence scoring
  - Cross-validation
  - LLM-based summarization

**Usage**:
```bash
POST /api/knowledge/fuse
{
  "query": "What is quantum computing?",
  "sources": ["wikipedia", "web"],
  "maxResults": 10,
  "minConfidence": 0.6,
  "summarize": true
}
```

### 5. Reasoning Engine ✅

- **File**: `src/core/knowledge/ReasoningEngine.ts`
- **Features**:
  - Chain-of-Thought reasoning
  - Multi-step reasoning
  - Tool integration
  - Confidence calculation

**Usage**:
```bash
POST /api/reasoning/chain-of-thought
{
  "question": "If a train leaves station A at 60 mph and another leaves station B at 80 mph, when do they meet?",
  "context": "Station A and B are 200 miles apart",
  "maxSteps": 5
}
```

## 📊 Recommended Datasets

### General Knowledge
1. **Wikipedia Dumps**
   - Download: https://dumps.wikimedia.org/
   - Format: XML/JSON
   - Size: Varies (can extract specific topics)

2. **Common Crawl**
   - Download: https://commoncrawl.org/
   - Format: WARC files
   - Size: Very large (filter by domain/topic)

3. **OpenWebText**
   - Download: https://github.com/eukaryote31/openwebtext
   - Format: Text files
   - Size: ~38GB

### Domain-Specific
1. **ArXiv Papers** (Scientific)
   - Download: https://arxiv.org/help/bulk_data
   - Format: LaTeX/PDF
   - Size: Large

2. **Stack Overflow** (Technical)
   - Download: https://archive.org/details/stackexchange
   - Format: XML
   - Size: ~50GB

3. **PubMed** (Medical)
   - Download: https://www.ncbi.nlm.nih.gov/pmc/tools/openftlist/
   - Format: XML
   - Size: Very large

4. **Books** (Literature)
   - Project Gutenberg: https://www.gutenberg.org/
   - Format: Plain text
   - Size: Individual books

### Structured Data
1. **Wikidata** (Knowledge Graph)
   - Download: https://www.wikidata.org/wiki/Wikidata:Database_download
   - Format: JSON/XML
   - Size: Large

2. **DBpedia** (Structured Wikipedia)
   - Download: https://www.dbpedia.org/resources/downloads/
   - Format: RDF/JSON
   - Size: Large

3. **ConceptNet** (Common Sense)
   - Download: https://github.com/commonsense/conceptnet5
   - Format: JSON
   - Size: Medium

## 🚀 Quick Start - Adding Datasets

### 1. Add Wikipedia Knowledge
```bash
# Search and add Wikipedia articles
curl -X POST http://localhost:3001/api/knowledge/wikipedia \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "limit": 10}'
```

### 2. Load CSV Dataset
```bash
# Create a CSV file
echo "topic,description
AI,Artificial Intelligence
ML,Machine Learning" > knowledge-base/ai-topics.csv

# Load it
curl -X POST http://localhost:3001/api/knowledge/load-csv \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./knowledge-base/ai-topics.csv", "generateEmbeddings": true}'
```

### 3. Build Knowledge Graph
```bash
# Add entities
curl -X POST http://localhost:3001/api/knowledge/graph/entity \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "e1",
    "name": "Neural Network",
    "type": "Concept",
    "properties": {"category": "AI", "invented": "1943"}
  }'
```

### 4. Use Advanced Reasoning
```bash
curl -X POST http://localhost:3001/api/reasoning/chain-of-thought \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does a transformer model work?",
    "maxSteps": 5
  }'
```

## 🎯 Making the Bot Smarter

### Strategy 1: Pre-load High-Quality Datasets
1. Download Wikipedia articles on your domain
2. Extract and chunk them
3. Generate embeddings
4. Load into knowledge base on startup

### Strategy 2: Real-time Knowledge Fetching
- Enable Wikipedia source
- Enable web scraping (with domain restrictions)
- Use knowledge fusion for multi-source answers

### Strategy 3: Build Domain Knowledge Graph
- Extract entities from your documents
- Build relationships
- Query graph for related concepts

### Strategy 4: Enable Advanced Reasoning
- Use chain-of-thought for complex questions
- Multi-step reasoning for problem-solving
- Tool integration for fact-checking

## 📈 Performance Tips

1. **Batch Embeddings**: Generate embeddings in batches for large datasets
2. **Incremental Loading**: Load datasets incrementally to avoid memory issues
3. **Caching**: Cache frequently accessed knowledge
4. **Indexing**: Use knowledge graph for fast entity lookups
5. **Deduplication**: Remove duplicate knowledge before ingestion

## 🔧 Configuration

Add to `.env`:
```env
# Knowledge Sources
ENABLE_WIKIPEDIA=true
ENABLE_WEB_SCRAPING=true
WEB_SCRAPING_ALLOWED_DOMAINS=example.com,another.com

# Knowledge Graph
ENABLE_KNOWLEDGE_GRAPH=true
KNOWLEDGE_GRAPH_MAX_ENTITIES=10000

# Reasoning
ENABLE_REASONING=true
REASONING_MAX_STEPS=5
```

## 📚 Example Dataset Files

### Sample CSV (`knowledge-base/faq.csv`)
```csv
question,answer,category
What is AI?,Artificial Intelligence is...,General
How does ML work?,Machine Learning...,Technical
```

### Sample JSON (`knowledge-base/knowledge.json`)
```json
[
  {
    "topic": "Neural Networks",
    "description": "Neural networks are...",
    "related": ["Deep Learning", "AI"]
  }
]
```

All features are production-ready and integrated! 🚀

