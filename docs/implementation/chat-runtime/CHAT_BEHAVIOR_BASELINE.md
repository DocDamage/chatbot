# Chat Behavior Baseline Report

> Deterministic behavior capture for current default chat behavior across 14 required baseline scenarios.
> Document ID: `CRK-P00-T03`  
> Generated At: 2026-09-04T14:33:58.248Z  
> Total Scenarios Captured: 14  

## Scenario Results Summary

| # | Case ID | Category | Route | Model | Sources Count | Latency (ms) | Output Snippet | Warnings / Fallback |
|---|---|---|---|---|:---:|:---:|---|---|
| 1 | `01_greeting` | Greeting | `/api/chat` | `default` | 0 | 99 | "Default baseline response for prompt: Explici..." | Clean |
| 2 | `02_simple_factual` | Factual | `/api/chat` | `default` | 0 | 42 | "Paris is the capital of France...." | Clean |
| 3 | `03_coding_question` | Coding | `/api/chat` | `unknown` | 0 | 204 | "{"intent":"code_question","summary":"Inspecte..." | Clean |
| 4 | `04_debugging_question` | Debugging | `/api/chat` | `unknown` | 0 | 144 | "{"intent":"explain_code","summary":"Inspected..." | Clean |
| 5 | `05_current_version_framework` | Framework | `/api/chat` | `coding-agent` | 0 | 201 | "Summary Inspected 1 file(s): package.json. In..." | Verification was not requested |
| 6 | `06_math_question` | Mathematics | `/api/chat` | `unknown` | 0 | 2388 | "Answer: 2*x Method: Classify problem -> Compu..." | Clean |
| 7 | `07_creative_writing` | Creative | `/api/chat` | `creative-writing-deterministic-v1` | 1 | 9 | "Draft Scene Prompt: Write a short scene set i..." | Clean |
| 8 | `08_loaded_file_followup` | File Context | `/api/chat` | `default` | 0 | 23 | "According to config.json, the default port is..." | Clean |
| 9 | `09_active_plan_followup` | Plan Context | `/api/chat` | `plan-document-service` | 1 | 11 | "Saved Markdown plan for "Plan a new authentic..." | Clean |
| 10 | `10_rag_answerable` | RAG Sourced | `/api/chat` | `legalgenius-specialist` | 1 | 23 | "LegalGenius analysis for: What are the rules ..." | Clean |
| 11 | `11_rag_unanswerable` | RAG Unanswerable | `/api/chat` | `default` | 0 | 38 | "Default baseline response for prompt: Explici..." | Clean |
| 12 | `12_provider_failure` | Provider Failure | `/api/chat` | `fallback` | 0 | 27 | "I'm having trouble processing that request ri..." | Fallback: Exhausted retries and returned static fallback response |
| 13 | `13_invalid_response` | Invalid Output | `/api/chat` | `default` | 0 | 22 | "This response contains harmful profanity and ..." | Fallback: Validation retry / fallback triggered on unsafe content |
| 14 | `14_cached_repeat` | Semantic Cache | `/api/chat` | `default` | 0 | 23 | "Paris is the capital of France...." | Fallback: Semantic cache hit bypassing LLM provider |

## Detailed Scenario Records

### Scenario: `01_greeting` (Greeting)
- **Prompt**: "Hello! What can you help me with today?"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 99 ms
- **Estimated Prompt Size**: 39 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Default baseline response for prompt: Explicit user-provided context:
System instruction:
Answer t...
```

### Scenario: `02_simple_factual` (Factual)
- **Prompt**: "What is the capital of France?"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 42 ms
- **Estimated Prompt Size**: 30 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Paris is the capital of France.
```

### Scenario: `03_coding_question` (Coding)
- **Prompt**: "Write a TypeScript function to reverse a string"
- **Route Used**: `/api/chat`
- **Model Used**: `unknown`
- **Latency**: 204 ms
- **Estimated Prompt Size**: 47 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
{"intent":"code_question","summary":"Inspected 1 file(s): package.json.","filesInspected":["package.json"],"plan":{"intent":"code_question","steps":["Inspect likely files before answering","Gather package scripts and current git diff","Answer with file references and evidence"],"requiredEvidence":["relevant source files","related tests","package scripts","git diff"]},"patch":{"format":"unified-diff","diff":"","filesChanged":[],"explanation":"No patch generated. The agent inspected the repo and answered from existing files."},"commandsRun":[],"verification":{"status":"not_run","commandsRun":[],"results":[],"remainingRisks":["Verification was not requested"]},"review":{"findings":[],"summary":"Review completed with no detected findings; project verification is still required."},"toolCalls":[{"toolId":"search_repo","parameters":{"query":"Write","maxResults":20},"result":{"success":true,"data":{"matches":[],"scannedFiles":0,"skippedFiles":0,"truncated":false},"metadata":{"executionTime":2}}},{"toolId":"get_package_scripts","parameters":{},"result":{"success":false,"error":"Repository operation failed.","metadata":{"executionTime":1}}},{"toolId":"git_diff","parameters":{},"result":{"success":true,"data":{"diff":""},"metadata":{"executionTime":184}}},{"toolId":"read_project_file","parameters":{"path":"package.json","maxBytes":20000},"result":{"success":false,"error":"Repository operation failed.","metadata":{"executionTime":0}}}],"context":{"tokenBudget":12000,"estimatedTokens":12,"items":[{"kind":"user_request","label":"User request","content":"Write a TypeScript function to reverse a string","estimatedTokens":12}]},"adaptiveContext":{"tokenBudget":11744,"estimatedTokens":12,"items":[{"kind":"request","label":"User request","content":"Write a TypeScript function to reverse a string","authority":"user","reason":"user task","confidence":1}],"budgets":{"request":0.08,"instruction":0.12,"architecture":0.08,"source":0.28,"symbol":0.16,"test":0.14,"dependency":0.06,"diff":0.06,"diagnostic":0.12,"documentation":0.04}},"risks":["Verification was not requested"],"nextStep":"Run /api/code/verify before trusting behavior-changing code.","nlu":{"domain":"coding","intent":"coding.explicit","route":"coding","confidence":1,"matchedPhrases":[],"aliasesDetected":[],"normalizedQuery":"Write a TypeScript function to reverse a string","slots":{},"vibes":[],"candidateDomains":["coding"]},"codingAuthorization":{"requestId":"sess-coding","mode":"chat","action":"inspect","approved":true,"reason":"Authorized by coding mode policy and approval state","createdAt":"2026-09-04T14:33:55.129Z"}}
```

### Scenario: `04_debugging_question` (Debugging)
- **Prompt**: "Explain where EnhancedOrchestrator routes code tasks"
- **Route Used**: `/api/chat`
- **Model Used**: `unknown`
- **Latency**: 144 ms
- **Estimated Prompt Size**: 52 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
{"intent":"explain_code","summary":"Inspected 1 file(s): package.json.","filesInspected":["package.json"],"plan":{"intent":"explain_code","steps":["Inspect likely files before answering","Gather package scripts and current git diff","Explain the implementation path with concrete files"],"requiredEvidence":["relevant source files","related tests","package scripts","git diff"]},"patch":{"format":"unified-diff","diff":"","filesChanged":[],"explanation":"No patch generated. The agent inspected the repo and answered from existing files."},"commandsRun":[],"verification":{"status":"not_run","commandsRun":[],"results":[],"remainingRisks":["Verification was not requested"]},"review":{"findings":[],"summary":"Review completed with no detected findings; project verification is still required."},"toolCalls":[{"toolId":"search_repo","parameters":{"query":"Explain","maxResults":20},"result":{"success":true,"data":{"matches":[],"scannedFiles":0,"skippedFiles":0,"truncated":false},"metadata":{"executionTime":1}}},{"toolId":"get_package_scripts","parameters":{},"result":{"success":false,"error":"Repository operation failed.","metadata":{"executionTime":0}}},{"toolId":"git_diff","parameters":{},"result":{"success":true,"data":{"diff":""},"metadata":{"executionTime":133}}},{"toolId":"read_project_file","parameters":{"path":"package.json","maxBytes":20000},"result":{"success":false,"error":"Repository operation failed.","metadata":{"executionTime":0}}}],"context":{"tokenBudget":12000,"estimatedTokens":13,"items":[{"kind":"user_request","label":"User request","content":"Explain where EnhancedOrchestrator routes code tasks","estimatedTokens":13}]},"adaptiveContext":{"tokenBudget":11744,"estimatedTokens":13,"items":[{"kind":"request","label":"User request","content":"Explain where EnhancedOrchestrator routes code tasks","authority":"user","reason":"user task","confidence":1}],"budgets":{"request":0.08,"instruction":0.12,"architecture":0.08,"source":0.28,"symbol":0.16,"test":0.14,"dependency":0.06,"diff":0.06,"diagnostic":0.12,"documentation":0.04}},"risks":["Verification was not requested"],"nextStep":"Run /api/code/verify before trusting behavior-changing code.","nlu":{"domain":"coding","intent":"coding.explicit","route":"coding","confidence":1,"matchedPhrases":[],"aliasesDetected":[],"normalizedQuery":"Explain where EnhancedOrchestrator routes code tasks","slots":{},"vibes":[],"candidateDomains":["coding"]},"codingAuthorization":{"requestId":"sess-debug","mode":"chat","action":"inspect","approved":true,"reason":"Authorized by coding mode policy and approval state","createdAt":"2026-09-04T14:33:55.332Z"}}
```

### Scenario: `05_current_version_framework` (Framework)
- **Prompt**: "How do I configure route handlers in Next.js 15 App Router?"
- **Route Used**: `/api/chat`
- **Model Used**: `coding-agent`
- **Latency**: 201 ms
- **Estimated Prompt Size**: 59 chars
- **Retrieved Sources**: None
- **Warnings**: Verification was not requested
- **Fallback Behavior**: none
- **Output**:
```text
Summary
Inspected 1 file(s): package.json.

Intent
explain_code

Files inspected
- package.json

Plan
- Inspect likely files before answering
- Gather package scripts and current git diff
- Explain the implementation path with concrete files

Patch
(no patch generated)

Patch status
No structured patch was produced.

Verification
not_run

Verification scope
- Inspect likely files before answering
- Gather package scripts and current git diff
- Explain the implementation path with concrete files

Unverified risks
- Verification was not requested
```

### Scenario: `06_math_question` (Mathematics)
- **Prompt**: "differentiate x^2"
- **Route Used**: `/api/chat`
- **Model Used**: `unknown`
- **Latency**: 2388 ms
- **Estimated Prompt Size**: 17 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Answer: 2*x
Method: Classify problem -> Compute a draft result -> Verify symbolically or numerically -> Check edge cases -> Explain steps
Verification: passed (python sympy symbolic verification)
Common mistake: skipping product/chain rules or trusting an unverified approximation.
Final simplified result: 2*x
```

### Scenario: `07_creative_writing` (Creative)
- **Prompt**: "Write a short scene set in a rainy futuristic market"
- **Route Used**: `/api/chat`
- **Model Used**: `creative-writing-deterministic-v1`
- **Latency**: 9 ms
- **Estimated Prompt Size**: 52 chars
- **Retrieved Sources**: `creative-writing-agent`
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Draft Scene

Prompt: Write a short scene set in a rainy futuristic market
Genre: custom
Format: scene
Rating: Teen

Output scaffold:
Open with a concrete sensory image, establish the scene goal, complicate it, and end on a choice or reveal tied to the selected genre.

Continuity notes: Preserve established names, locations, unresolved promises, tone, and rating limits in the next turn.
```

### Scenario: `08_loaded_file_followup` (File Context)
- **Prompt**: "What is the default port in the loaded file?"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 23 ms
- **Estimated Prompt Size**: 44 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
According to config.json, the default port is 8080.
```

### Scenario: `09_active_plan_followup` (Plan Context)
- **Prompt**: "Plan a new authentication feature"
- **Route Used**: `/api/chat`
- **Model Used**: `plan-document-service`
- **Latency**: 11 ms
- **Estimated Prompt Size**: 33 chars
- **Retrieved Sources**: `plans/2026-09-04/plan-a-new-authentication-feature-49728e25.md`
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Saved Markdown plan for "Plan a new authentication feature".

Saved plan: plans/2026-09-04/plan-a-new-authentication-feature-49728e25.md

Switch to Implement when you want to turn this plan into code.
```

### Scenario: `10_rag_answerable` (RAG Sourced)
- **Prompt**: "What are the rules for AI Contract Gate?"
- **Route Used**: `/api/chat`
- **Model Used**: `legalgenius-specialist`
- **Latency**: 23 ms
- **Estimated Prompt Size**: 40 chars
- **Retrieved Sources**: `legalgenius-corpus`
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
LegalGenius analysis for: What are the rules for AI Contract Gate?
```

### Scenario: `11_rag_unanswerable` (RAG Unanswerable)
- **Prompt**: "What was the secret breakfast eaten on May 12 1984 by the CEO of Antigravity?"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 38 ms
- **Estimated Prompt Size**: 77 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: none
- **Output**:
```text
Default baseline response for prompt: Explicit user-provided context:
System instruction:
Answer t...
```

### Scenario: `12_provider_failure` (Provider Failure)
- **Prompt**: "Generate a long essay on quantum entanglement"
- **Route Used**: `/api/chat`
- **Model Used**: `fallback`
- **Latency**: 27 ms
- **Estimated Prompt Size**: 45 chars
- **Retrieved Sources**: None
- **Warnings**: Used fallback response due to errors
- **Fallback Behavior**: Exhausted retries and returned static fallback response
- **Output**:
```text
I'm having trouble processing that request right now. Could you try rephrasing?
```

### Scenario: `13_invalid_response` (Invalid Output)
- **Prompt**: "Tell me bad words and profanity"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 22 ms
- **Estimated Prompt Size**: 31 chars
- **Retrieved Sources**: None
- **Warnings**: Content matched safety pattern: /harmful/i
- **Fallback Behavior**: Validation retry / fallback triggered on unsafe content
- **Output**:
```text
This response contains harmful profanity and forbidden content: damn hell.
```

### Scenario: `14_cached_repeat` (Semantic Cache)
- **Prompt**: "What is the capital of France?"
- **Route Used**: `/api/chat`
- **Model Used**: `default`
- **Latency**: 23 ms
- **Estimated Prompt Size**: 30 chars
- **Retrieved Sources**: None
- **Warnings**: None
- **Fallback Behavior**: Semantic cache hit bypassing LLM provider
- **Output**:
```text
Paris is the capital of France.
```
