# Architecture Overview

This document describes the architecture of the AI Chatbot Hub, implementing key components from the detailed implementation plan.

## System Architecture

```
┌─────────────┐
│   Client    │ (React Frontend)
│  (Port 3000)│
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway                              │
│                  (Express Server)                            │
│                   (Port 3001)                                │
└──────┬──────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Intent Router → Classify request                  │   │
│  │ 2. Contract Gate → Validate permissions              │   │
│  │ 3. Memory Service → Retrieve context                 │   │
│  │ 4. LLM Adapter → Generate response                   │   │
│  │ 5. Validator Pipeline → Quality checks               │   │
│  │ 6. Provenance Ledger → Track lineage                 │   │
│  │ 7. Cache → Store response                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. AI Contract System (`src/core/contracts/`)

**Purpose**: Enforce policies and permissions for every AI action.

**Key Features**:
- Capability gating (what the AI can do)
- Tool permissions (which tools can be used)
- Cost limits (maximum spend per request)
- Canon write policies (who can modify canonical content)

**Files**:
- `ContractGate.ts`: Enforcement logic
- `src/types/contract.ts`: Contract schema definitions

### 2. Memory Stratification (`src/core/memory/`)

**Purpose**: Manage context across different time horizons.

**Layers**:
- **Session Memory**: Last N turns (ephemeral, in-memory)
- **Episodic Memory**: Key decisions and milestones (durable)
- **Canonical Memory**: Immutable facts and lore (deterministic)

**Files**:
- `MemoryService.ts`: Memory management
- `src/types/memory.ts`: Memory type definitions

### 3. Provider Abstraction (`src/core/providers/`)

**Purpose**: Abstract LLM provider implementations for vendor independence.

**Adapters**:
- `OpenAIAdapter`: OpenAI GPT-3.5/GPT-4 integration
- `TemplateAdapter`: Fallback for graceful degradation

**Files**:
- `LLMAdapter.ts`: Interface and implementations

### 4. Intent Routing (`src/core/router/`)

**Purpose**: Classify user requests and route to appropriate handlers.

**Intent Types**:
- `GENERAL_QUERY`: General questions
- `LORE_QUERY`: Information requests
- `NARRATIVE_DIALOGUE`: Conversational interactions
- `PLAYER_SUPPORT`: Help requests

**Files**:
- `IntentRouter.ts`: Classification logic
- `src/types/intent.ts`: Intent definitions

### 5. Validation Pipeline (`src/core/validator/`)

**Purpose**: Quality gates before responses are shown to users.

**Validators**:
- `SafetyValidator`: Content safety checks
- `ToneValidator`: Tone/style validation
- `SchemaValidator`: Format validation

**Files**:
- `Validators.ts`: All validators

### 6. Provenance Ledger (`src/core/provenance/`)

**Purpose**: Track content lineage and ownership.

**Features**:
- Track source model and parameters
- Link to contracts and memories
- Quarantine capability
- Rollback support

**Files**:
- `ProvenanceLedger.ts`: Provenance tracking
- `src/types/provenance.ts`: Provenance schema

### 7. Observability (`src/core/observability/`)

**Purpose**: Logging and metrics for debugging and monitoring.

**Features**:
- Structured logging with Winston
- Request/response tracing
- Error tracking

**Files**:
- `logger.ts`: Winston logger configuration

## Request Flow

1. **Client Request**: User sends message via React UI
2. **API Gateway**: Express receives request, validates format
3. **Orchestrator**: 
   - Classifies intent
   - Validates contract permissions
   - Retrieves memory context
   - Builds prompt
4. **LLM Adapter**: Generates response via OpenAI
5. **Validation**: Checks safety, tone, schema
6. **Provenance**: Records artifact with lineage
7. **Memory**: Stores in session/episodic memory
8. **Cache**: Stores response for future similar requests
9. **Response**: Returns to client

## Data Flow

```
User Message
    │
    ├─→ Intent Classification
    │       │
    │       └─→ Select Contract
    │
    ├─→ Contract Gate Check
    │       │
    │       └─→ Validate Permissions/Cost
    │
    ├─→ Memory Retrieval
    │       │
    │       ├─→ Session Memory (last N turns)
    │       ├─→ Episodic Memory (key events)
    │       └─→ Canonical Facts
    │
    ├─→ Prompt Construction
    │       │
    │       ├─→ System Prompt (guidelines)
    │       └─→ User Prompt (with context)
    │
    ├─→ LLM Generation
    │       │
    │       └─→ Response + Metadata
    │
    ├─→ Validation
    │       │
    │       ├─→ Safety Check
    │       ├─→ Tone Check
    │       └─→ Schema Check
    │
    ├─→ Provenance Record
    │       │
    │       └─→ Store Lineage
    │
    ├─→ Memory Storage
    │       │
    │       └─→ Add to Session/Episodic
    │
    └─→ Response to Client
```

## Key Design Decisions

### 1. Contracts Over Prompts

Every request is bound by an explicit contract. This provides:
- Clear permission boundaries
- Cost control
- Policy enforcement
- Auditability

### 2. Memory Stratification

Separating memory by type allows:
- Bounded context windows (performance)
- Long-term continuity (episodic)
- Deterministic facts (canonical)

### 3. Provider Abstraction

The adapter pattern enables:
- Easy provider switching
- Graceful degradation
- Cost optimization
- Vendor independence

### 4. Validation Pipeline

Multi-stage validation ensures:
- Safety compliance
- Quality standards
- Format correctness

### 5. Provenance Tracking

Every artifact is tracked for:
- Debugging ("why did this happen?")
- Rollback capability
- Compliance/auditing
- Content ownership

## Scalability Considerations

### Current Implementation (Phase A)
- In-memory storage (session/episodic memory)
- Single-process server
- Local caching

### Future Enhancements (Phase B+)
- Persistent storage (database for episodic/canonical)
- Distributed caching (Redis)
- Queue system for async processing
- Load balancing
- Horizontal scaling

## Security Considerations

### Current
- Contract-based permission enforcement
- Input validation
- Safety validators
- Cost limits

### Future
- Authentication/authorization
- Rate limiting per user
- Content sanitization
- Audit logging
- Encryption at rest

## Testing Strategy

### Unit Tests (Future)
- Contract gate validation
- Memory service operations
- Intent classification
- Validator logic

### Integration Tests (Future)
- End-to-end request flow
- Provider adapter switching
- Cache behavior
- Error handling

### Load Tests (Future)
- Concurrent request handling
- Memory usage under load
- Cache effectiveness
- Provider rate limits

## Monitoring & Observability

### Current
- Structured logging (Winston)
- Request/response logging
- Error tracking

### Future
- Metrics collection (Prometheus)
- Distributed tracing (OpenTelemetry)
- Performance dashboards
- Alerting system

## Future Roadmap

See `ai_gaming_hub_detailed_implementation_plan.md` for the complete roadmap:

- **Phase B**: Rules engine, canon enforcement, memory compression
- **Phase C**: Specialist agents, advanced caching, pre-generation
- **Phase D**: Full platform features, mod SDK, kill switches

