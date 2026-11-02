import { CanonicalRuntimeConfigManager, canonicalRuntimeConfigSchema } from '../CanonicalRuntimeConfig';

describe('CanonicalRuntimeConfig', () => {
  beforeEach(() => {
    CanonicalRuntimeConfigManager.resetInstance();
  });

  it('provides safe production defaults when env is empty', () => {
    const config = CanonicalRuntimeConfigManager.getInstance({}).getConfig();
    expect(config.CHAT_RUNTIME_V2_ENABLED).toBe('false');
    expect(config.CHAT_RUNTIME_V2_SHADOW).toBe('false');
    expect(config.CHAT_DEFAULT_BOT_PROFILE).toBe('default');
    expect(config.CHAT_DEFAULT_MODEL_POLICY).toBe('AUTO');
    expect(config.CHAT_MAX_CONTEXT_TOKENS).toBe(8192);
    expect(config.CHAT_ANSWER_RESERVE_TOKENS).toBe(2048);
    expect(config.KNOWLEDGE_PACKS_ENABLED).toBe('true');
    expect(config.KNOWLEDGE_MIN_FREE_DISK_GB).toBe(5);
    expect(config.RAG_MAX_SELECTED_CHUNKS).toBe(8);
    expect(config.RAG_MIN_GROUNDING_SCORE).toBe(0.7);
    expect(config.PROMPT_RETENTION_POLICY).toBe('anonymized');
    expect(config.DIAGNOSTICS_REDACTION_ENABLED).toBe('true');
  });

  it('parses customized environment overrides correctly', () => {
    const customEnv: NodeJS.ProcessEnv = {
      CHAT_RUNTIME_V2_ENABLED: 'true',
      CHAT_RUNTIME_V2_SHADOW: 'true',
      CHAT_DEFAULT_MODEL_POLICY: 'CODING',
      CHAT_MAX_CONTEXT_TOKENS: '16384',
      KNOWLEDGE_DATA_ROOT: '/custom/knowledge',
      KNOWLEDGE_MIN_FREE_DISK_GB: '15',
      RAG_MAX_SELECTED_CHUNKS: '12',
      RAG_RETRIEVAL_POLICY: 'strict',
      PROMPT_RETENTION_POLICY: 'ephemeral'
    };

    const manager = CanonicalRuntimeConfigManager.getInstance(customEnv);
    expect(manager.isV2Enabled()).toBe(true);
    expect(manager.isShadowEnabled()).toBe(true);
    const config = manager.getConfig();
    expect(config.CHAT_DEFAULT_MODEL_POLICY).toBe('CODING');
    expect(config.CHAT_MAX_CONTEXT_TOKENS).toBe(16384);
    expect(config.KNOWLEDGE_DATA_ROOT).toBe('/custom/knowledge');
    expect(config.KNOWLEDGE_MIN_FREE_DISK_GB).toBe(15);
    expect(config.RAG_MAX_SELECTED_CHUNKS).toBe(12);
    expect(config.RAG_RETRIEVAL_POLICY).toBe('strict');
    expect(config.PROMPT_RETENTION_POLICY).toBe('ephemeral');
  });

  it('rejects invalid enum values gracefully via schema safeParse', () => {
    const invalidEnv = {
      CHAT_DEFAULT_MODEL_POLICY: 'NON_EXISTENT_POLICY'
    };
    const result = canonicalRuntimeConfigSchema.safeParse(invalidEnv);
    expect(result.success).toBe(false);
  });

  it('generates a clean sanitized summary without secrets', () => {
    const manager = CanonicalRuntimeConfigManager.getInstance({});
    const summary = manager.getSanitizedSummary();
    expect(summary.runtimeV2).toBe(false);
    expect(summary.defaultPolicy).toBe('AUTO');
    expect(summary.contextWindowTokens).toBe(8192);
    expect(summary.groundingScore).toBe(0.7);
    expect(summary).not.toHaveProperty('API_KEY');
  });
});
