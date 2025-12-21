# Complete Data Sources Guide

## 🎯 All Available Data Sources

Your chatbot now has access to **16+ data sources** across multiple categories!

### 📚 Real-Time Knowledge Sources

1. **Wikipedia** ✅
   - General knowledge encyclopedia
   - API: Free, no key required
   - Endpoint: `POST /api/knowledge/wikipedia`

2. **Reddit** ✅
   - Community discussions and Q&A
   - Subreddit-specific search
   - Endpoint: `POST /api/knowledge/reddit`

3. **YouTube** ✅
   - Video content and descriptions
   - Requires: YouTube API key
   - Endpoint: `POST /api/knowledge/youtube`

4. **GitHub** ✅
   - Code repositories, issues, discussions
   - Optional: GitHub token (increases rate limits)
   - Endpoint: `POST /api/knowledge/github`

5. **Web Scraper** ✅
   - Any website content
   - Domain whitelisting support
   - Endpoint: `POST /api/knowledge/scrape`

### 🎓 Academic & Research Sources

6. **ArXiv** ✅
   - Scientific preprints and papers
   - Free, no key required
   - Endpoint: `POST /api/knowledge/papers` (source: "arxiv")

7. **PubMed** ✅
   - Medical and life sciences papers
   - Free, no key required
   - Endpoint: `POST /api/knowledge/papers` (source: "pubmed")

8. **BioRxiv** ✅
   - Biology preprints
   - Free, no key required
   - Endpoint: `POST /api/knowledge/papers` (source: "biorxiv")

9. **MIT OpenCourseWare** ✅
   - Free course materials
   - Endpoint: `POST /api/knowledge/university` (university: "mit")

10. **Harvard Online Learning** ✅
    - Course materials and resources
    - Endpoint: `POST /api/knowledge/university` (university: "harvard")

11. **Stanford Online** ✅
    - Course materials
    - Endpoint: `POST /api/knowledge/university` (university: "stanford")

12. **Brown University Repository** ✅
    - Academic resources
    - Endpoint: `POST /api/knowledge/university` (university: "brown")

### 📊 Structured Data Loaders

13. **CSV Files** ✅
    - Tabular data
    - Endpoint: `POST /api/knowledge/load-csv`

14. **JSON Files** ✅
    - Structured data
    - Endpoint: `POST /api/knowledge/load-json`

15. **SQLite Databases** ✅
    - Database tables
    - Endpoint: `POST /api/knowledge/load-sqlite`

16. **Telegram Exports** ✅
    - Conversation history
    - Endpoint: `POST /api/knowledge/load-telegram`

## 🚀 Usage Examples

### Search Reddit
```bash
curl -X POST http://localhost:3001/api/knowledge/reddit \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "subreddit": "MachineLearning",
    "limit": 20,
    "sort": "top"
  }'
```

### Search Scientific Papers
```bash
curl -X POST http://localhost:3001/api/knowledge/papers \
  -H "Content-Type: application/json" \
  -d '{
    "query": "transformer architecture attention",
    "source": "arxiv",
    "limit": 15
  }'
```

### Search GitHub
```bash
curl -X POST http://localhost:3001/api/knowledge/github \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "neural network pytorch",
    "type": "repositories",
    "limit": 10
  }'
```

### Load Telegram Conversations
```bash
curl -X POST http://localhost:3001/api/knowledge/load-telegram \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./telegram-export/result.json",
    "generateEmbeddings": true,
    "chunkSize": 20
  }'
```

### Multi-Source Knowledge Fusion
```bash
curl -X POST http://localhost:3001/api/knowledge/fuse \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is deep learning?",
    "sources": ["wikipedia", "reddit", "papers", "github"],
    "maxResults": 15,
    "minConfidence": 0.6,
    "summarize": true
  }'
```

## 📋 Recommended Datasets by Use Case

### For AI/ML Knowledge
- **ArXiv**: Search "deep learning", "neural networks", "transformer"
- **GitHub**: Popular ML frameworks (PyTorch, TensorFlow, etc.)
- **Reddit**: r/MachineLearning, r/learnmachinelearning
- **YouTube**: Educational ML channels

### For Software Development
- **GitHub**: Search code repositories
- **Reddit**: r/programming, r/webdev, r/learnprogramming
- **Stack Overflow**: Via web scraping

### For Academic Research
- **ArXiv**: Domain-specific papers
- **PubMed**: Medical/biology research
- **University Sources**: Course materials from top universities

### For General Knowledge
- **Wikipedia**: Broad coverage
- **Reddit**: Community knowledge
- **YouTube**: Educational content

## 🔧 Setup Instructions

### 1. YouTube API Key (Optional)
1. Go to https://console.cloud.google.com/
2. Create a project
3. Enable YouTube Data API v3
4. Create credentials (API key)
5. Add to `.env`: `YOUTUBE_API_KEY=your_key`

### 2. GitHub Token (Optional, Recommended)
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `public_repo`, `read:org`
4. Add to `.env`: `GITHUB_TOKEN=your_token`

### 3. Telegram Export
1. Open Telegram Desktop
2. Settings → Advanced → Export Telegram data
3. Select chats to export
4. Choose JSON format
5. Use exported file path in API

## 🎯 Making Your Bot Ultra-Smart

### Strategy 1: Pre-load High-Quality Datasets
```bash
# Load ArXiv papers on your domain
POST /api/knowledge/papers
{"query": "your domain", "source": "arxiv", "limit": 100}

# Load GitHub repositories
POST /api/knowledge/github
{"query": "relevant repos", "type": "repositories", "limit": 50}

# Load university course materials
POST /api/knowledge/university
{"university": "mit", "query": "your topic", "type": "courses"}
```

### Strategy 2: Real-Time Multi-Source Answers
Use knowledge fusion to combine multiple sources:
```bash
POST /api/knowledge/fuse
{
  "query": "user question",
  "sources": ["wikipedia", "reddit", "papers", "github"],
  "summarize": true
}
```

### Strategy 3: Domain-Specific Knowledge Base
1. Load domain-specific papers (ArXiv)
2. Load relevant GitHub repos
3. Load Reddit discussions from relevant subreddits
4. Load university course materials
5. Use knowledge graph to track relationships

## 📊 Source Comparison

| Source | Type | Free | API Key | Quality | Speed |
|--------|------|------|---------|---------|-------|
| Wikipedia | Real-time | ✅ | ❌ | High | Fast |
| Reddit | Real-time | ✅ | ❌ | Medium | Fast |
| YouTube | Real-time | ✅ | ✅ | Medium | Medium |
| GitHub | Real-time | ✅ | Optional | High | Fast |
| ArXiv | Real-time | ✅ | ❌ | Very High | Fast |
| PubMed | Real-time | ✅ | ❌ | Very High | Fast |
| Universities | Real-time | ✅ | ❌ | High | Medium |
| CSV/JSON | Static | ✅ | ❌ | Varies | Fast |
| Telegram | Static | ✅ | ❌ | Medium | Fast |

## 🎉 Total Data Sources: 16+

Your chatbot can now access:
- ✅ 5 Real-time knowledge sources
- ✅ 7 Academic/research sources
- ✅ 4 Structured data loaders
- ✅ Knowledge fusion across all sources
- ✅ Knowledge graph for relationships
- ✅ Advanced reasoning capabilities

**Your chatbot is now one of the most knowledge-rich AI systems available!** 🚀

