import { z } from 'zod';

const booleanText = z.enum(['true', 'false']).optional();
const integerText = z.string().regex(/^\d+$/).transform(Number);
const decimalText = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number);

export const canonicalRuntimeConfigSchema = z.object({
  // 32.1 Runtime
  CHAT_RUNTIME_V2_ENABLED: booleanText.default('false'),
  CHAT_RUNTIME_V2_SHADOW: booleanText.default('false'),
  CHAT_DEFAULT_BOT_PROFILE: z.string().default('default'),
  CHAT_DEFAULT_MODEL_POLICY: z.enum(['AUTO', 'FAST', 'BALANCED', 'REASONING', 'CODING', 'CREATIVE', 'LOCAL']).default('AUTO'),
  CHAT_DIAGNOSTICS_ENABLED: booleanText.default('true'),
  CHAT_MAX_CONTEXT_TOKENS: integerText.default('8192'),
  CHAT_ANSWER_RESERVE_TOKENS: integerText.default('2048'),

  // 32.2 Knowledge
  KNOWLEDGE_PACKS_ENABLED: booleanText.default('true'),
  KNOWLEDGE_DATA_ROOT: z.string().default('./data/knowledge'),
  KNOWLEDGE_MAX_DOWNLOAD_GB: integerText.default('10'),
  KNOWLEDGE_MAX_INDEX_GB: integerText.default('20'),
  KNOWLEDGE_MAX_DATASET_GB: integerText.default('50'),
  KNOWLEDGE_MIN_FREE_DISK_GB: integerText.default('5'),
  KNOWLEDGE_REFRESH_ENABLED: booleanText.default('true'),
  KNOWLEDGE_MAX_CONCURRENT_JOBS: integerText.default('2'),

  // 32.3 Retrieval
  RAG_MAX_CANDIDATES: integerText.default('50'),
  RAG_MAX_RERANK: integerText.default('20'),
  RAG_MAX_SELECTED_CHUNKS: integerText.default('8'),
  RAG_RETRIEVAL_POLICY: z.enum(['strict', 'balanced', 'fast', 'permissive']).default('balanced'),
  RAG_MIN_GROUNDING_SCORE: decimalText.default('0.70'),

  // 32.5 Feedback and Evals
  CHAT_FEEDBACK_ENABLED: booleanText.default('true'),
  CHAT_EVALS_ENABLED: booleanText.default('false'),
  CHAT_EVAL_PROVIDER: z.string().default('local'),

  // 32.6 Privacy
  CHAT_TRACE_RETENTION_DAYS: integerText.default('30'),
  PROMPT_RETENTION_POLICY: z.enum(['ephemeral', 'anonymized', 'retained']).default('anonymized'),
  DIAGNOSTICS_REDACTION_ENABLED: booleanText.default('true')
});

export type CanonicalRuntimeConfig = z.infer<typeof canonicalRuntimeConfigSchema>;

export class CanonicalRuntimeConfigManager {
  private static instance: CanonicalRuntimeConfigManager | null = null;
  private config: CanonicalRuntimeConfig;

  private constructor(env: NodeJS.ProcessEnv = process.env) {
    const parsed = canonicalRuntimeConfigSchema.safeParse(env);
    if (!parsed.success) {
      throw new Error(`Invalid Canonical Runtime Configuration: ${parsed.error.message}`);
    }
    this.config = parsed.data;
  }

  public static getInstance(env?: NodeJS.ProcessEnv): CanonicalRuntimeConfigManager {
    if (!this.instance || env) {
      this.instance = new CanonicalRuntimeConfigManager(env);
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  public getConfig(): CanonicalRuntimeConfig {
    return { ...this.config };
  }

  public isV2Enabled(): boolean {
    return this.config.CHAT_RUNTIME_V2_ENABLED === 'true';
  }

  public isShadowEnabled(): boolean {
    return this.config.CHAT_RUNTIME_V2_SHADOW === 'true';
  }

  public isKnowledgePacksEnabled(): boolean {
    return this.config.KNOWLEDGE_PACKS_ENABLED === 'true';
  }

  public getSanitizedSummary(): Record<string, unknown> {
    return {
      runtimeV2: this.isV2Enabled(),
      shadowMode: this.isShadowEnabled(),
      defaultProfile: this.config.CHAT_DEFAULT_BOT_PROFILE,
      defaultPolicy: this.config.CHAT_DEFAULT_MODEL_POLICY,
      diagnosticsEnabled: this.config.CHAT_DIAGNOSTICS_ENABLED === 'true',
      contextWindowTokens: this.config.CHAT_MAX_CONTEXT_TOKENS,
      reserveTokens: this.config.CHAT_ANSWER_RESERVE_TOKENS,
      knowledgePacksEnabled: this.isKnowledgePacksEnabled(),
      dataRoot: this.config.KNOWLEDGE_DATA_ROOT,
      minFreeDiskGB: this.config.KNOWLEDGE_MIN_FREE_DISK_GB,
      maxChunks: this.config.RAG_MAX_SELECTED_CHUNKS,
      retrievalPolicy: this.config.RAG_RETRIEVAL_POLICY,
      groundingScore: this.config.RAG_MIN_GROUNDING_SCORE,
      privacyPolicy: this.config.PROMPT_RETENTION_POLICY
    };
  }
}
