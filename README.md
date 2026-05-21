# AI Chatbot Hub

A production-grade AI chatbot application built following a comprehensive architecture plan. Features contract-based control, memory stratification, provider abstraction, provenance tracking, and observability.

## Features

- **🆓 Free Local LLMs**: Built-in Ollama support for free, local text generation (no API keys needed!)
- **Specialist Modes**: Text chat with planning, implementation, debugging, music, gaming, history, science, Knowledge OS, and other specialist modes
- **AI Contract System**: Every request is bound by explicit contracts with capability gating, cost limits, and policy enforcement
- **Memory Stratification**: Session (ephemeral), Episodic (durable), and Canonical (deterministic) memory layers
- **Provider Abstraction**: Swappable LLM providers (Ollama, OpenAI) with graceful degradation
- **Creative Writing & Roleplay**: Story bible continuity, long-form drafting, roleplay state, branches, prompt packs, privacy controls, and export workflows. See [docs/creative-writing.md](docs/creative-writing.md)
- **Intent Routing**: Automatic classification and routing of user requests
- **Validation Pipeline**: Safety, tone, and schema validation before responses
- **Provenance Ledger**: Full content lineage tracking for every response
- **Observability**: Structured logging and metrics
- **Modern UI**: React-based chat interface with provider settings, workspace context, and backend health status

## Architecture

The system follows a layered architecture:

```
Client → Gateway → Router/Orchestrator → Contract Gate → 
State Snapshot → (Memory + RAG) → Specialist Agent → 
Validators → Persist + Provenance → Response
```

### Core Services

- **Gateway/API**: Request handling, rate limits, auth
- **Router/Orchestrator**: Intent classification, agent selection, orchestration
- **Contract & Policy Gate**: Capability gating, tool permissions, cost ceilings
- **Memory Service**: Stratified memory management
- **LLM Adapter**: Provider abstraction layer
- **Validation Pipeline**: Quality gates
- **Provenance Ledger**: Content lineage tracking

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- **For Text Chat**: Ollama (free, local) - [Download here](https://ollama.ai)
- OpenAI API key (optional, if you prefer OpenAI over Ollama)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
cd client && npm install && cd ..
```

2. Create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=replace-with-at-least-32-random-characters
CORS_ORIGIN=http://localhost:3000

# Use Ollama (free, local LLM) - Recommended
USE_OLLAMA=true
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Or use OpenAI instead (requires API key)
# USE_OLLAMA=false
# OPENAI_API_KEY=your_openai_api_key_here

LOG_LEVEL=info
```

3. **Install Ollama** (if using free local LLM):
   ```bash
   # Download from https://ollama.ai
   # Then pull a model:
   ollama pull llama2
   ```

4. Build the project:

```bash
npm run build
```

### Running the Application

#### Development Mode (with hot reload)

```bash
npm run dev
```

This starts both the backend server (port 3001) and frontend dev server (port 3000).

#### Production Mode

```bash
# Build everything
npm run build

# Start the server
npm start
```

Then open http://localhost:3001 in your browser. The Express server serves the built React client from `client/dist` and exposes the API on the same origin.

Production deployments must provide a strong `JWT_SECRET` and an explicit `CORS_ORIGIN`. Privileged routes such as settings, file browsing, code verification, plan storage, audio browsing, Knowledge OS, online ingestion, admin/export, and webhooks require a bearer token with `admin` or `developer` roles.

## Project Structure

```
.
├── src/
│   ├── server/           # Express API server
│   ├── core/             # Core business logic
│   │   ├── contracts/    # AI contract system
│   │   ├── memory/       # Memory stratification
│   │   ├── providers/    # LLM adapter abstraction
│   │   ├── router/       # Intent routing
│   │   ├── orchestrator/ # Request orchestration
│   │   ├── validator/    # Validation pipeline
│   │   ├── provenance/   # Provenance ledger
│   │   └── observability/# Logging and metrics
│   └── types/            # TypeScript type definitions
├── client/               # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   └── ...
│   └── ...
└── ai_gaming_hub_detailed_implementation_plan.md  # Architecture plan
```

## Usage

### Text Chat
1. Start the application
2. Open the web interface at http://localhost:3000
3. Type your message and press Enter or click Send
4. The chatbot will respond using Ollama (or configured LLM provider)

### Image Generation
The active production chat surface renders text responses only. Legacy image-provider adapters may exist in the codebase, but Stable Diffusion is not exposed through the current settings UI or chat flow.

### System Features
- Classifies your intent automatically
- Enforces contracts and policies
- Retrieves relevant memories for context
- Validates responses for safety
- Tracks provenance for all content
- Caches responses for performance

## Configuration

### Environment Variables

**Server Configuration:**
- `PORT`: Backend server port (default: 3001)
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: Required secret for bearer-token authentication, minimum 32 characters
- `CORS_ORIGIN`: Required explicit browser origin in production
- `LOG_LEVEL`: Logging level (debug/info/warn/error)

**LLM Configuration:**
- `USE_OLLAMA`: Use Ollama for free local LLM (default: true)
- `OLLAMA_URL`: Ollama API URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model to use (default: llama2)
- `OPENAI_API_KEY`: OpenAI API key (only if USE_OLLAMA=false)

### Contract Configuration

Contracts define what the AI can do. Default contract allows:
- General queries and dialogue generation
- Episodic memory persistence
- Cost limit: $0.10 per request
- Max latency: 5000ms

Modify contracts in `src/types/contract.ts` or pass custom contracts in API requests.

## API Endpoints

### POST /api/chat

Send a chat message.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "sessionId": "unique-session-id",
  "userId": "optional-user-id"
}
```

**Response:**
```json
{
  "response": "Hello! I'm doing well, thank you for asking.",
  "artifactId": "uuid-of-response",
  "contractVersion": "1.0.0",
  "latency": 1234,
  "model": "gpt-3.5-turbo",
  "warnings": []
}
```

### GET /health

Health check endpoint.

## Architecture Principles

1. **Deterministic Core / Probabilistic Shell**: Core logic is deterministic; AI provides probabilistic variations
2. **Contracts Over Prompts**: Every action is bound by explicit contracts
3. **Graceful Degradation**: System works even if AI is slow/down (fallbacks, caches)
4. **Provenance & Canon Levels**: Every artifact is tagged with source, lineage, and rollback capability
5. **Observability-First**: Full tracing of what happened, why, and how to reproduce

## Future Enhancements

Based on the implementation plan, future phases include:

- **Phase B**: Rules engine, canon enforcement, episodic memory compression
- **Phase C**: Intent routing with specialist agents, caching, pre-generation pools
- **Phase D**: Full provenance tooling, mod SDK, economy guardrails, kill switches

## License

MIT

## Contributing

This is a reference implementation following a detailed architecture plan. Contributions welcome!

