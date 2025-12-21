# Additional Topic-Specific Data Sources

## 🎯 18 New Specialized Sources Added

### 1. Financial Advice ✅
**File**: `src/core/knowledge/FinancialAdviceSource.ts`

**Sources**:
- SEC Investor Education
- FINRA Investor Education
- CFPB Financial Education
- Investopedia
- Khan Academy Finance

**Usage**:
```bash
POST /api/knowledge/financial-advice
{"query": "retirement planning", "limit": 10}
```

### 2. Religion ✅
**File**: `src/core/knowledge/ReligionSource.ts`

**Sources**:
- Library of Congress - Religion
- Project Gutenberg - Religious Texts
- Internet Sacred Text Archive
- Harvard Divinity School

**Usage**:
```bash
POST /api/knowledge/religion
{"query": "Buddhism", "religion": "Buddhism", "limit": 10}
```

### 3. Mental Health ✅
**File**: `src/core/knowledge/MentalHealthSource.ts`

**Sources**:
- NIMH (National Institute of Mental Health)
- SAMHSA
- Mental Health America
- NAMI
- CDC Mental Health

**Usage**:
```bash
POST /api/knowledge/mental-health
{"query": "anxiety disorders", "limit": 10}
```

### 4. Web Design ✅
**File**: `src/core/knowledge/WebDesignSource.ts`

**Sources**:
- MDN Web Design
- Web.dev
- A List Apart
- Smashing Magazine
- CSS-Tricks

**Usage**:
```bash
POST /api/knowledge/web-design
{"query": "responsive design", "limit": 10}
```

### 5. UI Design ✅
**File**: `src/core/knowledge/UIDesignSource.ts`

**Sources**:
- Material Design (Google)
- Apple Human Interface Guidelines
- Nielsen Norman Group
- UI Patterns
- Dribbble

**Usage**:
```bash
POST /api/knowledge/ui-design
{"query": "design patterns", "limit": 10}
```

### 6. Backend Design ✅
**File**: `src/core/knowledge/BackendDesignSource.ts`

**Sources**:
- REST API Tutorial
- Google API Design Guide
- Microsoft API Guidelines
- 12 Factor App
- System Design Primer

**Usage**:
```bash
POST /api/knowledge/backend-design
{"query": "REST API design", "limit": 10}
```

### 7. Music Theory ✅
**File**: `src/core/knowledge/MusicTheorySource.ts`

**Sources**:
- Music Theory.net
- Open Music Theory
- Khan Academy Music
- MIT Music Theory

**Usage**:
```bash
POST /api/knowledge/music-theory
{"query": "chord progressions", "limit": 10}
```

### 8. LLM Programming ✅
**File**: `src/core/knowledge/LLMProgrammingSource.ts`

**Sources**:
- Hugging Face Transformers
- OpenAI API Docs
- LangChain
- Anthropic Claude Docs
- LLM Fine-tuning Guide

**Usage**:
```bash
POST /api/knowledge/llm-programming
{"query": "fine-tuning models", "limit": 10}
```

### 9. Anatomy ✅
**File**: `src/core/knowledge/AnatomySource.ts`

**Sources**:
- Visible Body
- Kenhub Anatomy
- TeachMeAnatomy
- Gray's Anatomy Online
- PubMed Anatomy

**Usage**:
```bash
POST /api/knowledge/anatomy
{"query": "cardiovascular system", "limit": 10}
```

### 10. Pottery ✅
**File**: `src/core/knowledge/PotterySource.ts`

**Sources**:
- Ceramic Arts Network
- The Pottery Wheel
- Digital Fire
- Pottery Making Info

**Usage**:
```bash
POST /api/knowledge/pottery
{"query": "glazing techniques", "limit": 10}
```

### 11. Gardening ✅
**File**: `src/core/knowledge/GardeningSource.ts`

**Sources**:
- USDA Plant Database
- RHS Gardening
- Gardening Know How
- Almanac Gardening

**Usage**:
```bash
POST /api/knowledge/gardening
{"query": "tomato growing", "limit": 10}
```

### 12. CNA (Certified Nursing Assistant) ✅
**File**: `src/core/knowledge/CNASource.ts`

**Sources**:
- NNAAP CNA Exam
- CNA Training Help
- Red Cross CNA
- CNA Plus

**Usage**:
```bash
POST /api/knowledge/cna
{"query": "patient care skills", "limit": 10}
```

### 13. DSP (Direct Support Professional) ✅
**File**: `src/core/knowledge/DSPSource.ts`

**Sources**:
- NADSP
- DSP Training
- College of Direct Support

**Usage**:
```bash
POST /api/knowledge/dsp
{"query": "disability support", "limit": 10}
```

### 14. RN (Registered Nurse) ✅
**File**: `src/core/knowledge/RNSource.ts`

**Sources**:
- NCSBN
- ANA (American Nurses Association)
- Nurse.org
- Nursing CE Central

**Usage**:
```bash
POST /api/knowledge/rn
{"query": "nursing procedures", "limit": 10}
```

### 15. Astronomy ✅
**File**: `src/core/knowledge/AstronomySource.ts`

**Sources**:
- NASA
- ESA (European Space Agency)
- Hubble Space Telescope
- Astronomy.com
- Sky & Telescope

**Usage**:
```bash
POST /api/knowledge/astronomy
{"query": "black holes", "limit": 10}
```

### 16. Astrology ✅
**File**: `src/core/knowledge/AstrologySource.ts`

**Sources**:
- Astro.com
- Cafe Astrology
- Astrology.com

**Usage**:
```bash
POST /api/knowledge/astrology
{"query": "zodiac signs", "limit": 10}
```

### 17. Botany ✅
**File**: `src/core/knowledge/BotanySource.ts`

**Sources**:
- USDA Plants Database
- Missouri Botanical Garden
- Botany.org
- Kew Gardens

**Usage**:
```bash
POST /api/knowledge/botany
{"query": "plant taxonomy", "limit": 10}
```

### 18. Marijuana Growing (Complete Knowledge Base) ✅
**File**: `src/core/knowledge/MarijuanaGrowingSource.ts`

**Features**:
- Comprehensive cultivation knowledge base
- Covers all growth stages
- Detailed growing techniques
- Nutrient and lighting guides

**Knowledge Base Topics**:
- Germination
- Seedling Stage
- Vegetative Growth
- Flowering Stage
- Harvesting
- Curing
- Nutrients
- Lighting
- Growing Mediums
- Pests & Diseases

**Sources**:
- Grow Weed Easy
- ILGM Growing Guide
- Leafly Growing
- Cannabis Training University
- Royal Queen Seeds Guide

**Usage**:
```bash
POST /api/knowledge/marijuana-growing
{"query": "flowering stage", "limit": 10}
```

## 📊 Complete Source Count

### Total: 48+ Data Sources!

**Real-Time Knowledge**: 9 sources
**Academic & Research**: 7 sources
**Technical Documentation**: 5 sources
**Entertainment**: 4 types
**Books**: 3 sources
**Specialized Topics**: 4 topics
**New Topic Sources**: 18 sources
**Library of Congress**: 1 source
**Structured Data**: 4 loaders

## 🚀 Usage Examples

### Financial Advice
```bash
curl -X POST http://localhost:3001/api/knowledge/financial-advice \
  -H "Content-Type: application/json" \
  -d '{"query": "401k investment strategies", "limit": 10}'
```

### Mental Health
```bash
curl -X POST http://localhost:3001/api/knowledge/mental-health \
  -H "Content-Type: application/json" \
  -d '{"query": "cognitive behavioral therapy", "limit": 10}'
```

### Web Design
```bash
curl -X POST http://localhost:3001/api/knowledge/web-design \
  -H "Content-Type: application/json" \
  -d '{"query": "CSS grid layout", "limit": 10}'
```

### UI Design
```bash
curl -X POST http://localhost:3001/api/knowledge/ui-design \
  -H "Content-Type: application/json" \
  -d '{"query": "mobile UI patterns", "limit": 10}'
```

### Backend Design
```bash
curl -X POST http://localhost:3001/api/knowledge/backend-design \
  -H "Content-Type: application/json" \
  -d '{"query": "microservices architecture", "limit": 10}'
```

### Music Theory
```bash
curl -X POST http://localhost:3001/api/knowledge/music-theory \
  -H "Content-Type: application/json" \
  -d '{"query": "jazz harmony", "limit": 10}'
```

### LLM Programming
```bash
curl -X POST http://localhost:3001/api/knowledge/llm-programming \
  -H "Content-Type: application/json" \
  -d '{"query": "prompt engineering", "limit": 10}'
```

### Anatomy
```bash
curl -X POST http://localhost:3001/api/knowledge/anatomy \
  -H "Content-Type: application/json" \
  -d '{"query": "nervous system", "limit": 10}'
```

### Pottery
```bash
curl -X POST http://localhost:3001/api/knowledge/pottery \
  -H "Content-Type: application/json" \
  -d '{"query": "wheel throwing", "limit": 10}'
```

### Gardening
```bash
curl -X POST http://localhost:3001/api/knowledge/gardening \
  -H "Content-Type: application/json" \
  -d '{"query": "composting", "limit": 10}'
```

### CNA
```bash
curl -X POST http://localhost:3001/api/knowledge/cna \
  -H "Content-Type: application/json" \
  -d '{"query": "vital signs", "limit": 10}'
```

### DSP
```bash
curl -X POST http://localhost:3001/api/knowledge/dsp \
  -H "Content-Type: application/json" \
  -d '{"query": "person-centered planning", "limit": 10}'
```

### RN
```bash
curl -X POST http://localhost:3001/api/knowledge/rn \
  -H "Content-Type: application/json" \
  -d '{"query": "medication administration", "limit": 10}'
```

### Astronomy
```bash
curl -X POST http://localhost:3001/api/knowledge/astronomy \
  -H "Content-Type: application/json" \
  -d '{"query": "exoplanets", "limit": 10}'
```

### Astrology
```bash
curl -X POST http://localhost:3001/api/knowledge/astrology \
  -H "Content-Type: application/json" \
  -d '{"query": "natal chart", "limit": 10}'
```

### Botany
```bash
curl -X POST http://localhost:3001/api/knowledge/botany \
  -H "Content-Type: application/json" \
  -d '{"query": "photosynthesis", "limit": 10}'
```

### Marijuana Growing (Complete Knowledge Base)
```bash
curl -X POST http://localhost:3001/api/knowledge/marijuana-growing \
  -H "Content-Type: application/json" \
  -d '{"query": "nutrients flowering stage", "limit": 10}'
```

## 🎯 Multi-Source Fusion

You can combine multiple sources in knowledge fusion:

```bash
POST /api/knowledge/fuse
{
  "query": "your question",
  "sources": [
    "financial_advice",
    "web_design",
    "ui_design",
    "backend_design",
    "llm_programming",
    "marijuana_growing"
  ],
  "summarize": true
}
```

## 📈 Source Quality

All sources include:
- ✅ Curated authoritative resources
- ✅ Wikipedia integration
- ✅ High confidence scoring (0.85-0.95)
- ✅ Topic-specific query enhancement
- ✅ Comprehensive knowledge coverage

**Your chatbot is now an expert in 48+ specialized domains!** 🚀

