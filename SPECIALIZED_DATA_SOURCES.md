# Specialized Data Sources

## 🎯 New Specialized Sources Added

### 1. Library of Congress ✅
**File**: `src/core/knowledge/LibraryOfCongressSource.ts`

**Features**:
- Access to LOC digital collections
- Historical documents and records
- Format filtering (books, photos, maps, etc.)
- Date range filtering
- High authority (0.95 confidence)

**Usage**:
```bash
POST /api/knowledge/library-of-congress
{
  "query": "American history",
  "limit": 10,
  "format": "text",  # Optional: text, image, map, etc.
  "dateRange": "1800-1900"  # Optional
}
```

### 2. Entertainment Source ✅
**File**: `src/core/knowledge/EntertainmentSource.ts`

**Supports**:
- **Movies**: TMDb API integration
- **Cartoons**: Animated films and shows
- **Comics**: Comic books (ComicVine API)
- **Manga/Anime**: Jikan API (MyAnimeList)

**Usage**:
```bash
POST /api/knowledge/entertainment
{
  "query": "superhero",
  "type": "all",  # movie, cartoon, comic, manga, anime, all
  "limit": 10,
  "year": 2020  # Optional, for movies
}
```

**Setup**: Add to `.env`:
```env
TMDB_API_KEY=your_tmdb_key  # For movies/cartoons
OMDB_API_KEY=your_omdb_key  # Alternative movie API
COMICVINE_API_KEY=your_key  # For comics (optional)
```

### 3. Book Source (Enhanced) ✅
**File**: `src/core/knowledge/BookSource.ts`

**Supports**:
- **Google Books**: Comprehensive book database
- **Open Library**: Free book catalog
- **Project Gutenberg**: Free eBooks

**Usage**:
```bash
POST /api/knowledge/books
{
  "query": "science fiction",
  "source": "all",  # google_books, open_library, gutenberg, all
  "limit": 10,
  "author": "Isaac Asimov",  # Optional
  "isbn": "978-0-123456-78-9"  # Optional
}
```

**Setup**: Optional Google Books API key
```env
GOOGLE_BOOKS_API_KEY=your_key
```

### 4. Specialized Topics Source ✅
**File**: `src/core/knowledge/SpecializedTopicSource.ts`

**Topics**:
- **Civil Rights**: Curated sources on civil rights movement
- **Compliance Industry**: Regulatory compliance resources
- **Hip Hop History**: Complete history of hip hop
- **Connecticut History**: Historical information about Connecticut

**Features**:
- Curated authoritative sources
- Topic-specific query enhancement
- Multi-source aggregation
- High-quality knowledge bases

**Usage**:
```bash
POST /api/knowledge/specialized-topics
{
  "topic": "hip_hop_history",  # civil_rights, compliance, hip_hop_history, connecticut_history, all
  "query": "origins of hip hop",
  "limit": 10
}
```

## 📚 Curated Sources by Topic

### Civil Rights
- National Archives - Civil Rights records
- Library of Congress - Civil Rights oral histories
- Smithsonian - Civil Rights collections
- Stanford - Martin Luther King Jr. papers

### Compliance Industry
- SEC Compliance resources
- FINRA Compliance rules
- HIPAA Compliance information
- GDPR Compliance resources
- Compliance Institute resources

### Hip Hop History
- Hip Hop Archive (Harvard)
- Smithsonian Hip Hop Collection
- Library of Congress Hip Hop recordings
- Hip Hop Database

### Connecticut History
- Connecticut State Library
- Connecticut History articles
- Yale Connecticut History resources
- Library of Congress Connecticut collections

## 🎬 Entertainment Sources

### Movies
- **TMDb**: The Movie Database (requires API key)
- **OMDb**: Open Movie Database (alternative)
- Search by title, year, genre
- Get ratings, cast, plot summaries

### Cartoons
- Animated films and TV shows
- Filter by animation genre
- Release dates and ratings

### Comics
- **ComicVine API**: Comprehensive comic database
- Marvel, DC, and independent comics
- Issue numbers and publishers

### Manga/Anime
- **Jikan API**: MyAnimeList integration (free, no key)
- Manga and anime information
- Chapters, status, ratings, genres

## 📖 Book Sources

### Google Books
- Millions of books
- Full text search (where available)
- ISBN lookup
- Author, publisher, publication date

### Open Library
- Free book catalog
- Open access books
- Community-maintained

### Project Gutenberg
- 60,000+ free eBooks
- Public domain works
- Full text available

## 🚀 Usage Examples

### Search Library of Congress
```bash
curl -X POST http://localhost:3001/api/knowledge/library-of-congress \
  -H "Content-Type: application/json" \
  -d '{
    "query": "American Revolution",
    "limit": 20,
    "format": "text"
  }'
```

### Search Movies
```bash
curl -X POST http://localhost:3001/api/knowledge/entertainment \
  -H "Content-Type: application/json" \
  -d '{
    "query": "The Matrix",
    "type": "movie",
    "year": 1999
  }'
```

### Search Comics
```bash
curl -X POST http://localhost:3001/api/knowledge/entertainment \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Batman",
    "type": "comic",
    "limit": 10
  }'
```

### Search Manga
```bash
curl -X POST http://localhost:3001/api/knowledge/entertainment \
  -H "Content-Type: application/json" \
  -d '{
    "query": "One Piece",
    "type": "manga",
    "limit": 5
  }'
```

### Search Books
```bash
curl -X POST http://localhost:3001/api/knowledge/books \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Dune",
    "source": "all",
    "author": "Frank Herbert"
  }'
```

### Search Hip Hop History
```bash
curl -X POST http://localhost:3001/api/knowledge/specialized-topics \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "hip_hop_history",
    "query": "origins of rap music",
    "limit": 15
  }'
```

### Search Civil Rights
```bash
curl -X POST http://localhost:3001/api/knowledge/specialized-topics \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "civil_rights",
    "query": "Martin Luther King",
    "limit": 10
  }'
```

### Search Compliance Industry
```bash
curl -X POST http://localhost:3001/api/knowledge/specialized-topics \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "compliance",
    "query": "GDPR requirements",
    "limit": 10
  }'
```

### Search Connecticut History
```bash
curl -X POST http://localhost:3001/api/knowledge/specialized-topics \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "connecticut_history",
    "query": "colonial period",
    "limit": 10
  }'
```

## 🔧 API Keys Setup

### TMDb (Movies/Cartoons)
1. Go to https://www.themoviedb.org/settings/api
2. Request API key
3. Add to `.env`: `TMDB_API_KEY=your_key`

### Google Books (Optional)
1. Go to https://console.cloud.google.com/
2. Enable Books API
3. Create API key
4. Add to `.env`: `GOOGLE_BOOKS_API_KEY=your_key`

### ComicVine (Comics - Optional)
1. Go to https://comicvine.gamespot.com/api/
2. Register and get API key
3. Add to `.env`: `COMICVINE_API_KEY=your_key`

**Note**: Manga/Anime (Jikan API) and Open Library don't require API keys!

## 📊 Complete Source Count

### Total: 30+ Data Sources!

**Real-Time Knowledge**: 9 sources
**Academic & Research**: 7 sources
**Technical Documentation**: 5 sources
**Entertainment**: 4 types (movies, cartoons, comics, manga)
**Books**: 3 sources (Google Books, Open Library, Gutenberg)
**Specialized Topics**: 4 curated topics
**Structured Data**: 4 loaders
**Library of Congress**: 1 authoritative source

## 🎯 Making Your Bot an Expert

### For Entertainment Questions
- Use `entertainment` source for movies, cartoons, comics, manga
- High-quality metadata (ratings, release dates, genres)

### For Book Questions
- Use `books` source for novels, textbooks, literature
- Search by author, ISBN, or title

### For Historical Questions
- Use `library-of-congress` for authoritative historical documents
- Use `specialized-topics` for curated historical knowledge

### For Niche Topics
- **Civil Rights**: Comprehensive civil rights movement knowledge
- **Compliance**: Regulatory and compliance industry expertise
- **Hip Hop History**: Complete history from origins to present
- **Connecticut History**: Detailed Connecticut historical information

All sources are production-ready and integrated! 🚀

