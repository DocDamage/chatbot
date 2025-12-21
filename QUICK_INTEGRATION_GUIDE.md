# Quick Integration Guide - Phase 1 Features

This guide shows how to quickly integrate Phase 1 features into your existing chatbot.

## Option 1: Use Enhanced Orchestrator (Recommended)

Replace your existing orchestrator with the enhanced version:

```typescript
// Before
import { Orchestrator } from './core/orchestrator/Orchestrator';
const orchestrator = new Orchestrator(llmAdapter, imageAdapter);

// After
import { EnhancedOrchestrator } from './core/orchestrator/EnhancedOrchestrator';
const orchestrator = new EnhancedOrchestrator(
  llmAdapter,
  imageAdapter,
  {
    useRAG: true,              // Enable RAG system
    useModelRouting: true,      // Enable intelligent model selection
    useEnsemble: false,         // Use ensemble (slower but more accurate)
    useSafetyPipeline: true,    // Enable safety checks
    useSemanticCache: true      // Enable semantic caching
  }
);
```

## Option 2: Use Individual Components

### Add RAG to Existing Orchestrator

```typescript
import { RAGService } from './core/rag/RAGService';
import { DocumentChunk } from './types/rag';

// Initialize RAG
const ragService = new RAGService(llmAdapter);

// Add documents
const chunks: DocumentChunk[] = [
  {
    id: 'doc1',
    content: 'Your knowledge base content...',
    metadata: { source: 'kb.pdf', title: 'Knowledge Base' }
  }
];
ragService.addDocuments(chunks);

// In your orchestrator's processRequest:
if (shouldUseRAG(message)) {
  const ragResult = await ragService.processQuery(message, false);
  // Use ragResult.compressedContext in your prompt
}
```

### Add Model Routing

```typescript
import { ModelRouter, ModelProvider, TaskType } from './core/providers/ModelRouter';

const modelRouter = new ModelRouter();
modelRouter.registerAdapter(ModelProvider.OPENAI, openaiAdapter);
modelRouter.registerAdapter(ModelProvider.OLLAMA, ollamaAdapter);

// Route to best model
const taskType = inferTaskType(message);
const { adapter, selection } = await modelRouter.route(taskType, { prompt: message });
const response = await adapter.generate({ prompt: message });
```

### Add Safety Pipeline

```typescript
import { SafetyPipeline } from './core/safety/SafetyPipeline';

const safetyPipeline = new SafetyPipeline(llmAdapter, ragRetriever);

// After generating response
const safetyResult = await safetyPipeline.check(response, true);
if (!safetyResult.safe) {
  // Handle unsafe content
  if (safetyResult.mitigatedContent) {
    response = safetyResult.mitigatedContent;
  }
}
```

### Add Semantic Cache

```typescript
import { SemanticCache } from './core/cache/SemanticCache';

const semanticCache = new SemanticCache<ChatResponse>(3600, 0.7);

// Check cache before processing
const cached = semanticCache.get(message);
if (cached) {
  return cached;
}

// After generating response
semanticCache.set(message, response);
```

## Example: Full Integration

```typescript
import { EnhancedOrchestrator } from './core/orchestrator/EnhancedOrchestrator';
import { RAGService } from './core/rag/RAGService';
import { DocumentChunk } from './types/rag';

// Initialize
const ragService = new RAGService(llmAdapter);
const orchestrator = new EnhancedOrchestrator(
  llmAdapter,
  imageAdapter,
  {
    useRAG: true,
    useModelRouting: true,
    useSafetyPipeline: true,
    useSemanticCache: true,
    ragService: ragService  // Reuse instance
  }
);

// Add knowledge base documents
const documents: DocumentChunk[] = [
  // Your documents here
];
ragService.addDocuments(documents);

// Use orchestrator as normal
const response = await orchestrator.processRequest({
  message: 'What is AI?',
  sessionId: 'session-123'
});
```

## Environment Variables

Add to `.env`:

```env
ENABLE_RAG=true
ENABLE_MODEL_ROUTING=true
ENABLE_SAFETY_PIPELINE=true
ENABLE_SEMANTIC_CACHE=true
```

## Testing

Test individual components:

```typescript
// Test RAG
const ragResult = await ragService.processQuery('test query');
console.log(ragResult.response, ragResult.citations);

// Test Safety
const safetyResult = await safetyPipeline.check('test content');
console.log(safetyResult.safe, safetyResult.warnings);

// Test Model Routing
const { adapter, selection } = await modelRouter.route(TaskType.GENERAL, { prompt: 'test' });
console.log(selection.model, selection.confidence);
```

## Performance Tips

1. **RAG**: Only enable for information queries (questions starting with what/who/when/where/why/how)
2. **Ensemble**: Only use for critical responses (slower, more expensive)
3. **Semantic Cache**: Adjust similarity threshold (0.7 = 70% similarity required)
4. **Safety Pipeline**: Can be expensive, consider caching safety results

## Troubleshooting

**RAG not finding documents**: Make sure documents are added before querying
**Model routing failing**: Ensure adapters are registered for the providers you want to use
**Safety pipeline blocking everything**: Adjust thresholds or disable specific checks
**Semantic cache not matching**: Lower similarity threshold (e.g., 0.6 instead of 0.7)

