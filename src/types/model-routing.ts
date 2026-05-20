/**
 * Model Routing Types
 */

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  OLLAMA = 'ollama',
  HUGGINGFACE = 'huggingface',
  TEMPLATE = 'template'
}

export enum TaskType {
  SIMPLE_QUERY = 'simple_query',
  COMPLEX_REASONING = 'complex_reasoning',
  CODE_GENERATION = 'code_generation',
  CREATIVE_WRITING = 'creative_writing',
  ANALYSIS = 'analysis',
  MULTIMODAL = 'multimodal',
  MATH_SYMBOLIC = 'math_symbolic',
  MATH_PROOF = 'math_proof',
  MATH_NUMERIC = 'math_numeric',
  MARKET_RESEARCH = 'market_research',
  MARKET_RISK = 'market_risk',
  MARKET_BACKTEST = 'market_backtest',
  GAME_DESIGN = 'game_design',
  GAME_CODE = 'game_code',
  GAME_BALANCE = 'game_balance',
  GAME_PROTOTYPE = 'game_prototype',
  SIXSIGMA_QA = 'sixsigma_qa',
  SIXSIGMA_CALCULATION = 'sixsigma_calculation',
  SIXSIGMA_PROJECT_COACHING = 'sixsigma_project_coaching',
  SIXSIGMA_COMPLIANCE = 'sixsigma_compliance',
  SIXSIGMA_CERTIFICATION = 'sixsigma_certification',
  SIXSIGMA_SIMULATION = 'sixsigma_simulation',
  SIXSIGMA_EXPORT = 'sixsigma_export',
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

