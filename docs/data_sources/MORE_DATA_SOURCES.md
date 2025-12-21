# Additional Data Sources

## 🎯 New Sources Added

### 1. Stack Overflow ✅
**File**: `src/core/knowledge/StackOverflowSource.ts`

**Features**:
- Search questions and answers
- Tag-based filtering
- Extract accepted answers
- Confidence scoring based on votes and acceptance

**Usage**:
```bash
POST /api/knowledge/stackoverflow
{
  "query": "javascript async await",
  "tagged": ["javascript", "async-await"],
  "limit": 10,
  "sort": "votes"  # relevance, activity, votes, creation
}
```

**Setup**: Optional API key for higher rate limits
```env
STACKOVERFLOW_API_KEY=your_key
```

### 2. News Sources ✅
**File**: `src/core/knowledge/NewsSource.ts`

**Supported Providers**:
- **NewsAPI** - General news (requires API key)
- **The Guardian** - UK news (requires API key)
- **NY Times** - US news (requires API key)

**Features**:
- Real-time news articles
- Multiple news providers
- Language filtering
- High confidence scoring

**Usage**:
```bash
POST /api/knowledge/news
{
  "query": "artificial intelligence",
  "provider": "all",  # newsapi, guardian, nytimes, all
  "limit": 10,
  "language": "en"
}
```

**Setup**: Add API keys to `.env`:
```env
NEWS_API_KEY=your_newsapi_key
GUARDIAN_API_KEY=your_guardian_key
NYTIMES_API_KEY=your_nytimes_key
```

### 3. Medium ✅
**File**: `src/core/knowledge/MediumSource.ts`

**Features**:
- Search Medium articles
- Tag-based filtering
- Extract article content
- RSS feed support

**Usage**:
```bash
POST /api/knowledge/medium
{
  "query": "machine learning",
  "tag": "artificial-intelligence",
  "limit": 10
}
```

### 4. Quora ✅
**File**: `src/core/knowledge/QuoraSource.ts`

**Features**:
- Search Q&A from Quora
- Extract questions and answers
- Multiple answer support

**Usage**:
```bash
POST /api/knowledge/quora
{
  "query": "how does neural network work",
  "limit": 10
}
```

### 5. Project Gutenberg ✅
**File**: `src/core/knowledge/ProjectGutenbergSource.ts`

**Features**:
- Search free books
- Load full book text
- 60,000+ free eBooks

**Usage**:
```bash
POST /api/knowledge/gutenberg
{
  "query": "science fiction",
  "limit": 10
}
```

### 6. Documentation Sites ✅
**File**: `src/core/knowledge/DocumentationSource.ts`

**Supported Sites**:
- **MDN** (Mozilla Developer Network) - Web technologies
- **Python Docs** - Python documentation
- **Node.js Docs** - Node.js documentation
- **React Docs** - React framework
- **Vue.js Docs** - Vue framework

**Features**:
- Search technical documentation
- High reliability (official docs)
- Multiple documentation sites

**Usage**:
```bash
POST /api/knowledge/docs
{
  "query": "async function",
  "site": "all",  # mdn, python, node, react, vue, all
  "limit": 10
}
```

## 📊 Complete Source List (22+ Sources!)

### Real-Time Knowledge
1. ✅ Wikipedia
2. ✅ Reddit
3. ✅ YouTube
4. ✅ GitHub
5. ✅ Stack Overflow
6. ✅ News (NewsAPI, Guardian, NYTimes)
7. ✅ Medium
8. ✅ Quora
9. ✅ Web Scraper

### Academic & Research
10. ✅ ArXiv
11. ✅ PubMed
12. ✅ BioRxiv
13. ✅ MIT
14. ✅ Harvard
15. ✅ Stanford
16. ✅ Brown

### Technical Documentation
17. ✅ MDN
18. ✅ Python Docs
19. ✅ Node.js Docs
20. ✅ React Docs
21. ✅ Vue.js Docs

### Structured Data
22. ✅ CSV
23. ✅ JSON
24. ✅ SQLite
25. ✅ Telegram

### Books & Literature
26. ✅ Project Gutenberg

## 🚀 Usage Examples

### Search Stack Overflow
```bash
curl -X POST http://localhost:3001/api/knowledge/stackoverflow \
  -H "Content-Type: application/json" \
  -d '{
    "query": "react hooks useState",
    "tagged": ["react", "javascript"],
    "sort": "votes"
  }'
```

### Get Latest News
```bash
curl -X POST http://localhost:3001/api/knowledge/news \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AI developments",
    "provider": "all",
    "limit": 20
  }'
```

### Search Technical Documentation
```bash
curl -X POST http://localhost:3001/api/knowledge/docs \
  -H "Content-Type: application/json" \
  -d '{
    "query": "promise async",
    "site": "mdn",
    "limit": 10
  }'
```

### Multi-Source Fusion (All Sources!)
```bash
curl -X POST http://localhost:3001/api/knowledge/fuse \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is machine learning?",
    "sources": [
      "wikipedia",
      "reddit",
      "papers",
      "github",
      "stackoverflow",
      "news",
      "medium",
      "quora",
      "docs"
    ],
    "summarize": true,
    "maxResults": 20
  }'
```

## 🔧 API Keys Setup

### Stack Overflow (Optional)
- Get key: https://stackapps.com/apps/oauth/register
- Add to `.env`: `STACKOVERFLOW_API_KEY=your_key`

### NewsAPI (Required for news)
- Get key: https://newsapi.org/register
- Free tier: 100 requests/day
- Add to `.env`: `NEWS_API_KEY=your_key`

### The Guardian (Required)
- Get key: https://open-platform.theguardian.com/access/
- Free tier: 5,000 requests/day
- Add to `.env`: `GUARDIAN_API_KEY=your_key`

### NY Times (Required)
- Get key: https://developer.nytimes.com/get-started
- Free tier: 4,000 requests/day
- Add to `.env`: `NYTIMES_API_KEY=your_key`

## 📈 Source Quality Comparison

| Source | Type | Free | API Key | Quality | Speed | Best For |
|--------|------|------|---------|---------|-------|----------|
| Wikipedia | Real-time | ✅ | ❌ | High | Fast | General knowledge |
| Reddit | Real-time | ✅ | ❌ | Medium | Fast | Community insights |
| Stack Overflow | Real-time | ✅ | Optional | Very High | Fast | Technical Q&A |
| News | Real-time | ✅ | ✅ | High | Fast | Current events |
| Medium | Real-time | ✅ | ❌ | Medium | Medium | Articles |
| Quora | Real-time | ✅ | ❌ | Medium | Medium | Q&A |
| MDN | Real-time | ✅ | ❌ | Very High | Fast | Web tech docs |
| ArXiv | Real-time | ✅ | ❌ | Very High | Fast | Scientific papers |
| GitHub | Real-time | ✅ | Optional | High | Fast | Code examples |
| Gutenberg | Real-time | ✅ | ❌ | High | Medium | Books |

## 🎯 Recommended Use Cases

### For Programming Questions
- **Stack Overflow**: Best for code examples and solutions
- **GitHub**: Best for implementation examples
- **Documentation**: Best for official API references
- **Reddit**: Best for discussions and opinions

### For Current Events
- **News APIs**: Real-time news from multiple sources
- **Reddit**: Community discussions on current events
- **Twitter** (if added): Social media insights

### For Learning
- **University Sources**: Course materials
- **Medium**: Educational articles
- **Quora**: Expert answers
- **YouTube**: Video tutorials

### For Research
- **ArXiv/PubMed**: Scientific papers
- **Wikipedia**: General knowledge
- **University Repos**: Academic resources

## 🎉 Total: 26+ Data Sources!

Your chatbot now has access to one of the most comprehensive knowledge bases:
- ✅ 9 Real-time knowledge sources
- ✅ 7 Academic/research sources
- ✅ 5 Technical documentation sites
- ✅ 4 Structured data loaders
- ✅ 1 Book repository

**Your chatbot is now a knowledge powerhouse!** 🚀

