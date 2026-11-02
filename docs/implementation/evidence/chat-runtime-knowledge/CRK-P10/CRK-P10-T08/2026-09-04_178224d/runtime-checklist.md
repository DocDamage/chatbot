# Runtime Task Checklist — CRK-P10-T08: Model Registry & Model Policy Engine Exit Gate

## Phase 10 Definition of Done & Exit Gate (§2137-2143)

### Implementation
- [x] Model registry schema (`RegisteredModel`) matching §2021-2046 implemented (`src/types/model-registry.ts`).
- [x] `ModelRegistry` decoupled from policy engine (§2006-2016) implemented (`src/core/providers/ModelRegistry.ts`).
- [x] Stale assumptions removed and replaced with production seed models with verification timestamps (`src/core/providers/ModelRegistry.ts`).
- [x] 7 user-facing policies (`AUTO`, `FAST`, `BALANCED`, `REASONING`, `CODING`, `CREATIVE`, `LOCAL`) implemented (`src/types/model-registry.ts`).
- [x] Multi-dimensional model routing scored across task fit, capabilities, context length, health, latency, and cost (`src/core/providers/ModelPolicyEngine.ts`).
- [x] Fallback planner building strict fallback chains without dropping tools or breaking privacy mode (`src/core/providers/ModelFallbackPlanner.ts`).
- [x] Health checker tracking 7 provider health states and automatic cooldowns (`src/core/providers/ModelHealthChecker.ts`).
- [x] Source-size rule satisfied (all production files <= 181 lines, strictly under 300-line ceiling).

### Tests & Verification
- [x] Static router is no longer authoritative for current provider availability (§2139).
- [x] Model selection uses live/configured registry state (§2140).
- [x] Fallback behavior is truthful and observable (§2141).
- [x] User policies map to capability requirements (§2142).
- [x] Dynamic health check triggers observable failover upon rate-limiting or provider failure (§2115-2124).
- [x] User explicit model selection respected (§2074).
- [x] Full type check (`npm run type-check`: 0 errors).
- [x] Linter (`npm run lint:server`: 0 warnings/errors).
