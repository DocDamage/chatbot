# Missing Features from External Repositories

Based on analysis of top GitHub AI chatbot repositories, these features are not implemented in the current codebase:

---

## RAG & Knowledge

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Web search integration (15+ providers: SearXNG, Google, Brave, DuckDuckGo, Perplexity, etc.) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | 🔥 High |
| Document parsing (PDF, DOCX, PPTX, CSV, XLSX ingestion) | [RAGFlow](https://github.com/infiniflow/ragflow) ⭐70k | 🔥 High |
| Multiple vector database support (ChromaDB, PGVector, Qdrant, Milvus, Pinecone, etc.) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | 🔥 High |
| GraphRAG (graph-based knowledge retrieval) | [RAGFlow](https://github.com/infiniflow/ragflow) ⭐70k | Medium |
| Web browsing capability (fetch URLs into chat context) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |

---

## MCP & Extensibility

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| MCP (Model Context Protocol) support | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | 🔥 High |
| Plugin system / Pipelines framework | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | 🔥 High |
| Python function calling (Bring Your Own Function) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | 🔥 High |
| No-code agent builder | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | 🔥 High |

---

## Visual & Low-Code

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Visual workflow editor (drag-drop orchestration) | [Flowise](https://github.com/FlowiseAI/Flowise) ⭐47k | 🔥 High |
| Multi-agent visual configuration | [Flowise](https://github.com/FlowiseAI/Flowise) ⭐47k | Medium |

---

## Voice & Multimodal

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Voice input (Whisper, Deepgram, Azure STT) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| Text-to-Speech output (ElevenLabs, Azure, OpenAI TTS) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| Voice/Video call integration | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |

---

## Memory Enhancements

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Long-term memory persistence across conversations | [Mem0](https://github.com/mem0ai/mem0) ⭐44k | 🔥 High |
| Adaptive personalization based on user history | [Mem0](https://github.com/mem0ai/mem0) ⭐44k | 🔥 High |
| Agent-level memory (separate from user/session) | [Mem0](https://github.com/mem0ai/mem0) ⭐44k | 🔥 High |

---

## UI & UX

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Progressive Web App (PWA) with offline support | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| Embeddable chat widget for external websites | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Model builder (create custom Ollama models via UI) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |
| Prompt templates marketplace | [NextChat](https://github.com/ChatGPTNextWeb/NextChat) ⭐76k | Medium |
| Chat history compression (token optimization) | [NextChat](https://github.com/ChatGPTNextWeb/NextChat) ⭐76k | Medium |
| Share conversations as images | [NextChat](https://github.com/ChatGPTNextWeb/NextChat) ⭐76k | Low |

---

## Provider Support (Additional LLMs)

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Anthropic Claude | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Groq | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| DeepSeek | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Cohere | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Low |
| AWS Bedrock | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Azure OpenAI | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Mistral | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |
| Together AI | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Low |
| Fireworks AI | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Low |
| xAI (Grok) | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Low |
| Google Gemini Pro | [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) ⭐52k | Medium |

---

## Enterprise & Auth

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| LDAP/Active Directory integration | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |
| SSO (OAuth, SAML) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |
| SCIM 2.0 provisioning | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |
| Granular role-based access control (RBAC) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| Cloud storage integration (Google Drive, OneDrive) | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Low |

---

## Scalability

| Feature | Source Repository | Priority |
|---------|-------------------|----------|
| Horizontal scaling with Redis sessions | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| Multi-node WebSocket support | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |
| PostgreSQL as alternative to SQLite | [Open WebUI](https://github.com/open-webui/open-webui) ⭐118k | Medium |

---

## Reference Repositories

| Repository | Stars | Primary Use |
|------------|-------|-------------|
| [Open WebUI](https://github.com/open-webui/open-webui) | 118k | Full-featured UI, RAG, Voice, MCP |
| [RAGFlow](https://github.com/infiniflow/ragflow) | 70k | Advanced RAG engine |
| [NextChat](https://github.com/ChatGPTNextWeb/NextChat) | 76k | Polished chat UI |
| [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) | 52k | All-in-one, MCP, No-code agents |
| [Flowise](https://github.com/FlowiseAI/Flowise) | 47k | Visual workflow builder |
| [Mem0](https://github.com/mem0ai/mem0) | 44k | AI memory layer |
| [Quivr](https://github.com/QuivrHQ/quivr) | 39k | Easy RAG integration |
| [FastGPT](https://github.com/labring/FastGPT) | 28k | Workflow + RAG + plugins |
| [SuperPrompt](https://github.com/NeoVertex1/SuperPrompt) | 2k | Advanced prompt engineering |
