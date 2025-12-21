# Free Models Guide

This guide lists all free models available in the chatbot system, organized by category.

## 🆓 Free LLM Models

### Ollama Models (Local, Free, No API Key)

**Best Quality:**
- **llama3** - Meta's latest, best quality free model
  ```bash
  ollama pull llama3
  ```
  - Quality: 0.80
  - Use for: General queries, analysis, creative writing, code generation

**High Quality:**
- **mistral** - Fast and capable
  ```bash
  ollama pull mistral
  ```
  - Quality: 0.75
  - Use for: General tasks, analysis, creative writing

- **codellama** - Specialized for code
  ```bash
  ollama pull codellama
  ```
  - Quality: 0.75
  - Use for: Code generation, code analysis

**Good Quality:**
- **llama2** - Widely used, reliable
  ```bash
  ollama pull llama2
  ```
  - Quality: 0.70
  - Use for: General queries, simple tasks

- **gemma** - Google's open model
  ```bash
  ollama pull gemma
  ```
  - Quality: 0.72
  - Use for: General queries, creative writing

**Efficient:**
- **phi** - Small but efficient
  ```bash
  ollama pull phi
  ```
  - Quality: 0.65
  - Use for: Simple queries, fast responses

### Hugging Face Models (Free API, Rate Limited)

**No Setup Required** (uses Hugging Face Inference API):
- **Mistral 7B Instruct** - `mistralai/Mistral-7B-Instruct-v0.2`
  - Quality: 0.75
  - Rate limited, but free

- **Llama 2 7B Chat** - `meta-llama/Llama-2-7b-chat-hf`
  - Quality: 0.70
  - Rate limited, but free

- **Zephyr 7B** - `HuggingFaceH4/zephyr-7b-beta`
  - Quality: 0.73
  - Aligned chat model

**Setup:**
```env
USE_OLLAMA=false
USE_HUGGINGFACE=true
HUGGINGFACE_MODEL=mistralai/Mistral-7B-Instruct-v0.2
# HUGGINGFACE_API_KEY=optional (for higher rate limits)
```

## 🖼️ Free Vision Models

### LLaVA (Local, Free, No API Key)

**Setup:**
```bash
ollama pull llava
```

**Configuration:**
```env
USE_LLAVA=true
LLAVA_MODEL=llava
```

**Models:**
- **llava** - Standard LLaVA model
  - Quality: 0.70
  - Use for: Image understanding, VQA, OCR

- **llava:llama3** - LLaVA with Llama 3
  ```bash
  ollama pull llava:llama3
  ```
  - Quality: 0.75
  - Better quality than standard LLaVA

## 🔢 Free Embedding Models

### Xenova Transformers (Local, Free, No API Key)

**Default (Recommended):**
- **all-MiniLM-L6-v2** - `Xenova/all-MiniLM-L6-v2`
  - Dimensions: 384
  - Quality: 0.75
  - Fast and efficient

**Multilingual:**
- **Multilingual E5** - `Xenova/multilingual-e5-base`
  - Dimensions: 768
  - Quality: 0.80
  - Supports multiple languages

**BGE:**
- **BGE Small** - `Xenova/bge-small-en-v1.5`
  - Dimensions: 384
  - Quality: 0.78
  - Optimized for English

**Configuration:**
```env
EMBEDDING_PROVIDER=xenova
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```

### Ollama Embeddings (Local, Free)

**Nomic Embed:**
```bash
ollama pull nomic-embed-text
```

- Dimensions: 768
- Quality: 0.80
- Specialized for embeddings

**Configuration:**
```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
```

## 📊 Model Comparison

### LLM Models (Quality vs Cost)

| Model | Quality | Cost | Setup | Best For |
|-------|---------|------|-------|----------|
| llama3 (Ollama) | 0.80 | Free | `ollama pull llama3` | Best overall |
| mistral (Ollama) | 0.75 | Free | `ollama pull mistral` | Fast & capable |
| codellama (Ollama) | 0.75 | Free | `ollama pull codellama` | Code generation |
| Mistral (HF) | 0.75 | Free | None | API-based |
| llama2 (Ollama) | 0.70 | Free | `ollama pull llama2` | Reliable default |
| gpt-3.5-turbo | 0.80 | $0.002/1K | API key | Paid option |
| gpt-4 | 0.95 | $0.03/1K | API key | Best paid |

### Vision Models

| Model | Quality | Cost | Setup | Best For |
|-------|---------|------|-------|----------|
| LLaVA Llama 3 | 0.75 | Free | `ollama pull llava:llama3` | Best free |
| LLaVA | 0.70 | Free | `ollama pull llava` | Good free |
| GPT-4V | 0.95 | $0.01/1K | API key | Best paid |
| Gemini Vision | 0.90 | Paid | API key | High quality paid |

### Embedding Models

| Model | Dimensions | Quality | Cost | Setup |
|-------|------------|---------|------|-------|
| Multilingual E5 | 768 | 0.80 | Free | Auto-download |
| BGE Small | 384 | 0.78 | Free | Auto-download |
| all-MiniLM-L6-v2 | 384 | 0.75 | Free | Auto-download (default) |
| Nomic Embed | 768 | 0.80 | Free | `ollama pull nomic-embed-text` |
| OpenAI text-embedding-3-small | 1536 | 0.90 | $0.02/1M | API key |

## 🚀 Quick Start with Free Models

### 1. Install Ollama
```bash
# Download from https://ollama.ai
```

### 2. Pull Models
```bash
# Best free LLM
ollama pull llama3

# Best free vision
ollama pull llava:llama3

# Best free embeddings (optional, Xenova is default)
ollama pull nomic-embed-text
```

### 3. Configure `.env`
```env
# Use free models
USE_OLLAMA=true
OLLAMA_MODEL=llama3

# Free vision
USE_LLAVA=true
LLAVA_MODEL=llava:llama3

# Free embeddings (default)
EMBEDDING_PROVIDER=xenova
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
```

### 4. Start
```bash
npm run dev
```

## 💡 Recommendations

**For Best Free Experience:**
- LLM: `llama3` (Ollama)
- Vision: `llava:llama3` (Ollama)
- Embeddings: `Xenova/all-MiniLM-L6-v2` (default)

**For Code Generation:**
- LLM: `codellama` (Ollama)

**For Multilingual:**
- Embeddings: `Xenova/multilingual-e5-base`

**For API-Based (No Local Setup):**
- LLM: Hugging Face Mistral
- Embeddings: Xenova (still works, downloads automatically)

## 📝 Notes

- **Ollama models** require local installation but are completely free
- **Hugging Face models** are free but rate-limited (API key optional for higher limits)
- **Xenova embeddings** download automatically, no setup needed
- All free models work out of the box with default configuration

## 🔗 Resources

- Ollama: https://ollama.ai
- Hugging Face: https://huggingface.co
- Xenova Transformers: https://huggingface.co/Xenova

