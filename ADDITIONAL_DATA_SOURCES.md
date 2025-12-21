# Additional Data Sources

## 🎯 New Knowledge Sources Added

### 1. Reddit Source ✅
**File**: `src/core/knowledge/RedditSource.ts`

**Features**:
- Search Reddit posts and comments
- Subreddit-specific search
- Sort by relevance, hot, top, or new
- Confidence scoring based on upvotes and engagement

**Usage**:
```bash
POST /api/knowledge/reddit
{
  "query": "machine learning",
  "subreddit": "MachineLearning",  # Optional
  "limit": 10,
  "sort": "relevance"  # relevance, hot, top, new
}
```

### 2. YouTube Source ✅
**File**: `src/core/knowledge/YouTubeSource.ts`

**Features**:
- Search YouTube videos
- Extract video descriptions and metadata
- Confidence scoring based on views and likes
- Requires YouTube API key

**Usage**:
```bash
POST /api/knowledge/youtube
{
  "query": "neural networks explained",
  "limit": 10
}
```

**Setup**: Add to `.env`:
```env
YOUTUBE_API_KEY=your_youtube_api_key
```

### 3. University Sources ✅
**File**: `src/core/knowledge/UniversitySource.ts`

**Supported Universities**:
- MIT (OpenCourseWare)
- Harvard (Online Learning)
- Stanford (Online)
- Brown (Digital Repository)

**Features**:
- Search courses and research papers
- University-specific repositories
- Course materials and academic resources

**Usage**:
```bash
POST /api/knowledge/university
{
  "university": "mit",  # mit, harvard, stanford, brown
  "query": "artificial intelligence",
  "limit": 10,
  "type": "all"  # courses, papers, all
}
```

### 4. Scientific Papers Source ✅
**File**: `src/core/knowledge/ScientificPapersSource.ts`

**Supported Sources**:
- **ArXiv**: Preprints and published papers
- **PubMed**: Medical and life sciences papers
- **BioRxiv**: Biology preprints

**Features**:
- Search across multiple paper repositories
- Extract abstracts and metadata
- High confidence scoring (peer-reviewed sources)

**Usage**:
```bash
POST /api/knowledge/papers
{
  "query": "transformer architecture",
  "limit": 10,
  "source": "all"  # arxiv, pubmed, biorxiv, all
}
```

### 5. Telegram Source ✅
**File**: `src/core/knowledge/TelegramSource.ts`

**Features**:
- Load Telegram JSON exports
- Parse conversations and messages
- Chunk conversations for RAG
- Preserve metadata (dates, authors)

**Usage**:
```bash
POST /api/knowledge/load-telegram
{
  "filePath": "./telegram-export/result.json",
  "generateEmbeddings": true,
  "chunkSize": 20
}
```

**How to Export from Telegram**:
1. Open Telegram Desktop
2. Settings → Advanced → Export Telegram data
3. Select chats and export as JSON
4. Use the exported file path

### 6. GitHub Source ✅
**File**: `src/core/knowledge/GitHubSource.ts`

**Features**:
- Search repositories
- Search code files
- Search issues and discussions
- Extract README files
- Confidence scoring based on stars and activity

**Usage**:
```bash
POST /api/knowledge/github
{
  "query": "machine learning framework",
  "limit": 10,
  "type": "all"  # repositories, code, issues, all
}
```

**Setup**: Add to `.env` (optional, increases rate limits):
```env
GITHUB_TOKEN=your_github_token
```

## 📊 Complete Data Source List

### Real-Time Sources
1. ✅ **Wikipedia** - General knowledge
2. ✅ **Reddit** - Community discussions
3. ✅ **YouTube** - Video content
4. ✅ **GitHub** - Code repositories
5. ✅ **Web Scraper** - Any website

### Academic Sources
6. ✅ **ArXiv** - Scientific preprints
7. ✅ **PubMed** - Medical research
8. ✅ **BioRxiv** - Biology preprints
9. ✅ **MIT** - Course materials
10. ✅ **Harvard** - Academic resources
11. ✅ **Stanford** - Research papers
12. ✅ **Brown** - University repository

### Structured Data
13. ✅ **CSV** - Tabular data
14. ✅ **JSON** - Structured data
15. ✅ **SQLite** - Database tables
16. ✅ **Telegram** - Conversation exports

## 🚀 Quick Start Examples

### 1. Load Reddit Discussions
```bash
curl -X POST http://localhost:3001/api/knowledge/reddit \
  -H "Content-Type: application/json" \
  -d '{
    "query": "large language models",
    "subreddit": "MachineLearning",
    "limit": 20
  }'
```

### 2. Search Scientific Papers
```bash
curl -X POST http://localhost:3001/api/knowledge/papers \
  -H "Content-Type: application/json" \
  -d '{
    "query": "attention mechanism transformer",
    "source": "arxiv",
    "limit": 15
  }'
```

### 3. Load Telegram Conversations
```bash
curl -X POST http://localhost:3001/api/knowledge/load-telegram \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./telegram-export/result.json",
    "generateEmbeddings": true
  }'
```

### 4. Search GitHub Repositories
```bash
curl -X POST http://localhost:3001/api/knowledge/github \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural network implementation",
    "type": "repositories",
    "limit": 10
  }'
```

### 5. Get University Course Materials
```bash
curl -X POST http://localhost:3001/api/knowledge/university \
  -H "Content-Type: application/json" \
  -d '{
    "university": "mit",
    "query": "deep learning",
    "type": "courses"
  }'
```

## 🔧 Configuration

Add to `.env`:
```env
# YouTube API (optional)
YOUTUBE_API_KEY=your_youtube_api_key

# GitHub Token (optional, increases rate limits)
GITHUB_TOKEN=your_github_token

# Enable specific sources
ENABLE_REDDIT=true
ENABLE_YOUTUBE=true
ENABLE_GITHUB=true
ENABLE_SCIENTIFIC_PAPERS=true
```

## 📈 Making Your Bot Smarter

### Strategy 1: Pre-load High-Quality Sources
1. **Scientific Papers**: Load ArXiv papers on your domain
2. **GitHub**: Index relevant repositories
3. **University Materials**: Load course materials from top universities
4. **Reddit**: Index discussions from relevant subreddits

### Strategy 2: Real-Time Knowledge Fetching
- Enable Wikipedia for general knowledge
- Enable Reddit for community insights
- Enable scientific papers for research-backed answers
- Enable GitHub for code examples

### Strategy 3: Multi-Source Fusion
Use the knowledge fusion endpoint to combine multiple sources:
```bash
POST /api/knowledge/fuse
{
  "query": "What is reinforcement learning?",
  "sources": ["wikipedia", "reddit", "papers"],
  "summarize": true
}
```

## 🎯 Recommended Datasets by Domain

### AI/ML
- ArXiv: `machine learning`, `deep learning`, `neural networks`
- GitHub: Popular ML frameworks
- Reddit: `r/MachineLearning`, `r/learnmachinelearning`
- YouTube: Educational channels

### Software Development
- GitHub: Popular repositories
- Reddit: `r/programming`, `r/webdev`
- Stack Overflow (via web scraping)

### Academic Research
- ArXiv: Domain-specific papers
- PubMed: Medical/biology papers
- University repositories: Course materials

### General Knowledge
- Wikipedia: Broad coverage
- Reddit: Community knowledge
- YouTube: Educational content

All sources are production-ready and integrated! 🚀

