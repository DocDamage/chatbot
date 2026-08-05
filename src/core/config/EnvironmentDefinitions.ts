export type RuntimeProfile = 'development' | 'test' | 'local' | 'hosted';
export type EnvironmentRequirement = 'required' | 'optional' | 'deprecated' | 'local-only';

export interface EnvironmentDefinition {
  name: string;
  category: string;
  requirement: EnvironmentRequirement;
  description: string;
  secret?: boolean;
  defaultValue?: string;
  deprecatedBy?: string;
}

const optional = (name: string, category: string, description: string, defaultValue?: string): EnvironmentDefinition => ({
  name, category, requirement: 'optional', description, defaultValue
});
const secret = (name: string, category: string, description: string): EnvironmentDefinition => ({
  name, category, requirement: 'optional', description, secret: true
});
const localOnly = (name: string, category: string, description: string, defaultValue?: string): EnvironmentDefinition => ({
  name, category, requirement: 'local-only', description, defaultValue
});
const deprecated = (name: string, category: string, description: string, deprecatedBy: string): EnvironmentDefinition => ({
  name, category, requirement: 'deprecated', description, deprecatedBy
});

export const ENVIRONMENT_DEFINITIONS: EnvironmentDefinition[] = [
  optional('NODE_ENV', 'runtime', 'Node runtime environment.', 'development'),
  optional('DEPLOYMENT_MODE', 'runtime', 'Runtime profile: development, test, local, or hosted.'),
  optional('PORT', 'runtime', 'HTTP listen port.', '3001'),
  optional('BASE_URL', 'runtime', 'Canonical externally visible application URL.'),
  optional('STARTUP_TIMEOUT_MS', 'runtime', 'Maximum service initialization wait.', '30000'),
  optional('REQUEST_READY_TIMEOUT_MS', 'runtime', 'Maximum request readiness wait.', '10000'),
  secret('JWT_SECRET', 'security', 'JWT signing secret; required and strong outside tests.'),
  secret('CSRF_TOKEN', 'security', 'Static CSRF token for deployments that use the configured token policy.'),
  optional('CORS_ORIGIN', 'security', 'Exact allowed browser origin.', 'http://localhost:3000'),
  optional('CORS_CREDENTIALS', 'security', 'Whether credentialed CORS is enabled.', 'true'),
  secret('API_KEY_ENCRYPTION_SECRET', 'security', 'Dedicated key-encryption secret for stored provider credentials.'),
  optional('TRUST_PROXY', 'security', 'Express trusted proxy setting.', 'false'),
  optional('RATE_LIMIT_WINDOW_MS', 'security', 'Rate-limit window in milliseconds.', '60000'),
  optional('RATE_LIMIT_MAX_REQUESTS', 'security', 'Default requests allowed per window.', '100'),
  optional('LOG_LEVEL', 'observability', 'Application log level.', 'info'),
  optional('LLM_PROVIDER', 'providers', 'Primary LLM provider identifier.', 'template'),
  optional('USE_OLLAMA', 'providers', 'Enable Ollama provider.', 'false'),
  optional('OLLAMA_URL', 'providers', 'Ollama API URL.', 'http://localhost:11434'),
  optional('OLLAMA_MODEL', 'providers', 'Ollama model name.', 'llama2'),
  optional('USE_HUGGINGFACE', 'providers', 'Enable Hugging Face provider.', 'false'),
  optional('HUGGINGFACE_MODEL', 'providers', 'Hugging Face model identifier.'),
  secret('HUGGINGFACE_API_KEY', 'providers', 'Hugging Face API token.'),
  secret('OPENAI_API_KEY', 'providers', 'OpenAI API key.'),
  optional('OPENAI_MODEL', 'providers', 'OpenAI chat model.'),
  secret('OPENAI_COMPATIBLE_API_KEY', 'providers', 'OpenAI-compatible provider key.'),
  optional('OPENAI_COMPATIBLE_BASE_URL', 'providers', 'OpenAI-compatible provider base URL.'),
  optional('OPENAI_COMPATIBLE_MODEL', 'providers', 'OpenAI-compatible provider model.'),
  optional('OPENAI_COMPATIBLE_PROVIDER_NAME', 'providers', 'Display name for an OpenAI-compatible provider.'),
  secret('ANTHROPIC_API_KEY', 'providers', 'Anthropic API key.'),
  optional('ANTHROPIC_MODEL', 'providers', 'Anthropic model name.'),
  secret('GEMINI_API_KEY', 'providers', 'Google Gemini API key.'),
  optional('GEMINI_MODEL', 'providers', 'Google Gemini model name.'),
  optional('MAX_COST_PER_REQUEST', 'providers', 'Maximum estimated provider cost per request.', '0.10'),
  optional('MAX_LATENCY_MS', 'providers', 'Preferred provider latency ceiling.', '5000'),
  optional('MAX_RETRIES', 'providers', 'Maximum provider retries.', '3'),
  optional('EMBEDDING_PROVIDER', 'rag', 'Embedding provider: openai, xenova, or ollama.', 'xenova'),
  optional('EMBEDDING_MODEL', 'rag', 'Embedding model identifier.', 'Xenova/all-MiniLM-L6-v2'),
  optional('EMBEDDING_USE_TRANSFORMERS', 'rag', 'Enable local Transformers.js embeddings.', 'false'),
  optional('ENABLE_RAG', 'rag', 'Enable retrieval-augmented generation.', 'true'),
  optional('RAG_PERSISTENCE', 'rag', 'Persist RAG data.', 'true'),
  optional('RAG_SQLITE_PATH', 'rag', 'SQLite database path for local mode.', './data/chatbot.db'),
  optional('RAG_DATABASE_URL', 'rag', 'PostgreSQL URL for RAG persistence.'),
  optional('DATABASE_URL', 'data', 'Primary PostgreSQL URL.'),
  optional('RAG_RETRIEVAL_MODE', 'rag', 'Retrieval mode: memory, database, or hybrid.', 'memory'),
  optional('RAG_TOP_K', 'rag', 'Maximum retrieved chunks.', '10'),
  optional('RAG_SIMILARITY_THRESHOLD', 'rag', 'Minimum retrieval similarity.', '0.7'),
  optional('RAG_GENERATE_EMBEDDINGS', 'rag', 'Generate embeddings while ingesting.', 'true'),
  optional('RAG_CHUNK_SIZE', 'rag', 'Target chunk size.', '500'),
  optional('KNOWLEDGE_BASE_DIR', 'rag', 'Knowledge corpus root.', './knowledge-base'),
  optional('EAGER_KNOWLEDGE_LOAD', 'rag', 'Load the general corpus during startup.', 'false'),
  optional('EAGER_CODING_KNOWLEDGE_LOAD', 'rag', 'Load coding corpus during startup.', 'false'),
  optional('GROUNDING_MODE', 'rag', 'Grounding enforcement mode.', 'off'),
  optional('GROUNDING_REQUIRED_COVERAGE', 'rag', 'Minimum citation coverage.', '0.8'),
  optional('RERANKER_MODE', 'rag', 'Reranker implementation.', 'heuristic'),
  optional('ENABLE_REDIS_CACHE', 'cache', 'Enable Redis cache.', 'false'),
  optional('REDIS_URL', 'cache', 'Redis connection URL.', 'redis://localhost:6379'),
  optional('ENABLE_DISK_CACHE', 'cache', 'Enable local disk cache.', 'true'),
  optional('DISK_CACHE_DIR', 'cache', 'Disk cache directory.', './cache'),
  optional('SEMANTIC_CACHE_TTL', 'cache', 'Semantic-cache TTL seconds.', '3600'),
  optional('SEMANTIC_CACHE_SIMILARITY_THRESHOLD', 'cache', 'Semantic-cache similarity threshold.', '0.7'),
  optional('ENABLE_CONTRACTS', 'features', 'Enable contract validation.', 'true'),
  optional('ENABLE_MEMORY', 'features', 'Enable memory features.', 'true'),
  optional('ENABLE_PROVENANCE', 'features', 'Enable provenance tracking.', 'true'),
  optional('ENABLE_CACHING', 'features', 'Enable application caching.', 'true'),
  optional('ENABLE_MODEL_ROUTING', 'features', 'Enable model routing.', 'true'),
  deprecated('MODEL_ROUTING_ENABLED', 'features', 'Legacy model-routing flag.', 'ENABLE_MODEL_ROUTING'),
  optional('ENABLE_ENSEMBLE', 'features', 'Enable ensemble responses.', 'false'),
  deprecated('ENSEMBLE_ENABLED', 'features', 'Legacy ensemble flag.', 'ENABLE_ENSEMBLE'),
  optional('ENABLE_SAFETY_PIPELINE', 'features', 'Enable response safety pipeline.', 'true'),
  optional('ENABLE_SEMANTIC_CACHE', 'features', 'Enable semantic cache.', 'true'),
  optional('ENABLE_WEBSOCKET', 'features', 'Enable WebSocket server.', 'true'),
  optional('ENABLE_TOOL_CALLING', 'features', 'Enable model tool calls.', 'true'),
  localOnly('ENABLE_BASH_EXECUTOR', 'local-tools', 'Enable direct bash execution.', 'false'),
  localOnly('ENABLE_LOCAL_TOOLS', 'local-tools', 'Enable local-tool routes and services.', 'false'),
  localOnly('LOCAL_EXECUTION_ENABLED', 'local-tools', 'Master local execution switch.', 'false'),
  localOnly('LOCAL_TOOLS_DIR', 'local-tools', 'Local tool bundle directory.', './local-tools'),
  localOnly('PRIVATE_TOOL_BUNDLES_DIR', 'local-tools', 'Private local tool bundle directory.', './data/tools/private-bundles'),
  localOnly('SPRITE_LAB_DIR', 'local-tools', 'Sprite Lab workspace directory.', './data/sprite-lab'),
  localOnly('AUDIO_LAB_DIR', 'local-tools', 'Audio workspace directory.', './data/audio-lab'),
  localOnly('ENABLE_FL_STUDIO_MCP', 'local-tools', 'Enable FL Studio MCP bridge.', 'false'),
  optional('USE_LLAVA', 'vision', 'Enable LLaVA through Ollama.', 'false'),
  optional('LLAVA_MODEL', 'vision', 'LLaVA model name.', 'llava'),
  optional('USE_GEMINI_VISION', 'vision', 'Enable Gemini vision.', 'false'),
  optional('USE_GPT4V', 'vision', 'Enable OpenAI vision.', 'false'),
  optional('SEC_USER_AGENT', 'integrations', 'SEC fair-access user agent.'),
  optional('SEC_DATA_DIR', 'integrations', 'SEC data directory.', './data/sec'),
  optional('SEC_MAX_REQUESTS_PER_SECOND', 'integrations', 'SEC request pacing.', '8'),
  secret('GITHUB_TOKEN', 'integrations', 'GitHub API token for optional knowledge ingestion.'),
  secret('YOUTUBE_API_KEY', 'integrations', 'YouTube API key.'),
  secret('STACKOVERFLOW_API_KEY', 'integrations', 'Stack Overflow API key.'),
  secret('NEWS_API_KEY', 'integrations', 'News API key.'),
  secret('GUARDIAN_API_KEY', 'integrations', 'Guardian API key.'),
  secret('NYTIMES_API_KEY', 'integrations', 'New York Times API key.'),
  secret('TMDB_API_KEY', 'integrations', 'TMDB API key.'),
  secret('FRED_API_KEY', 'integrations', 'FRED API key.'),
  secret('TWILIO_ACCOUNT_SID', 'notifications', 'Twilio account SID.'),
  secret('TWILIO_AUTH_TOKEN', 'notifications', 'Twilio auth token.'),
  optional('TWILIO_FROM_NUMBER', 'notifications', 'Twilio sending phone number.'),
  optional('SAFETY_CHECK_FACTS', 'safety', 'Enable factual safety checks.', 'true'),
  optional('SAFETY_CONFIDENCE_THRESHOLD', 'safety', 'Safety confidence threshold.', '0.7')
];

export const ENVIRONMENT_DEFINITION_MAP = new Map(
  ENVIRONMENT_DEFINITIONS.map(definition => [definition.name, definition])
);

export function resolveDeploymentMode(env: NodeJS.ProcessEnv = process.env): RuntimeProfile {
  const explicit = env.DEPLOYMENT_MODE;
  if (explicit === 'development' || explicit === 'test' || explicit === 'local' || explicit === 'hosted') return explicit;
  if (env.NODE_ENV === 'test') return 'test';
  if (env.NODE_ENV === 'production') return 'hosted';
  return 'development';
}

export function isHostedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveDeploymentMode(env) === 'hosted';
}
