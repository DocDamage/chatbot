/**
 * Model Routing Types
 */

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
  TEMPLATE = 'template'
}

export enum TaskType {
  SIMPLE_QUERY = 'simple_query',
  COMPLEX_REASONING = 'complex_reasoning',
  CODE_GENERATION = 'code_generation',
  CREATIVE_WRITING = 'creative_writing',
  ANALYSIS = 'analysis',
  MULTIMODAL = 'multimodal',
  GENERAL = 'general'
}

export interface ModelCapability {
  provider: ModelProvider;
  model: string;
  taskTypes: TaskType[];
  maxTokens: number;
  supportsStreaming: boolean;
  costPer1kTokens: number;
  latencyMs: number;
  qualityScore: number; // 0-1
}

export interface ModelSelection {
  provider: ModelProvider;
  model: string;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
}

export interface EnsembleResponse {
  content: string;
  model: string;
  confidence: number;
  agreement: number; // Agreement between models (0-1)
  tokensUsed?: number;
  cost?: number;
  latency?: number;
}

