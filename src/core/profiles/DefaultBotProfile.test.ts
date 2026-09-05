/**
 * Unit Tests for DefaultBotProfile (CRK-P02-T03)
 *
 * Verifies source-controlled default profiles, schema conformance, and prompt asset resolution.
 */

import {
  DEFAULT_BOT_PROFILE,
  CODING_BOT_PROFILE,
  RESEARCH_BOT_PROFILE,
  BUILTIN_PROFILES,
  resolveSystemPromptAsset,
  PROMPT_ASSETS,
} from './DefaultBotProfile';
import { botProfileSchema } from '../../types/bot-profile';

describe('DefaultBotProfile (CRK-P02-T03)', () => {
  it('defines a valid DEFAULT_BOT_PROFILE that passes schema validation', () => {
    expect(() => botProfileSchema.parse(DEFAULT_BOT_PROFILE)).not.toThrow();
    expect(DEFAULT_BOT_PROFILE.id).toBe('default');
    expect(DEFAULT_BOT_PROFILE.isDefault).toBe(true);
    expect(DEFAULT_BOT_PROFILE.enabled).toBe(true);
    expect(DEFAULT_BOT_PROFILE.responseStyle).toBe('adaptive');
    expect(DEFAULT_BOT_PROFILE.citationPolicy).toBe('auto');
  });

  it('provides specialized builtin profiles for coding and research', () => {
    expect(CODING_BOT_PROFILE.id).toBe('coding');
    expect(CODING_BOT_PROFILE.citationPolicy).toBe('always-when-grounded');
    expect(RESEARCH_BOT_PROFILE.id).toBe('research');
    expect(RESEARCH_BOT_PROFILE.responseStyle).toBe('detailed');
    expect(BUILTIN_PROFILES).toHaveLength(3);
  });

  it('resolves system prompt assets without embedding massive literals in DB schemas', () => {
    const defaultPrompt = resolveSystemPromptAsset(DEFAULT_BOT_PROFILE.systemPromptAssetId);
    expect(defaultPrompt).toBe(PROMPT_ASSETS['prompt-general-assistant-v1']);

    const codingPrompt = resolveSystemPromptAsset(CODING_BOT_PROFILE.systemPromptAssetId);
    expect(codingPrompt).toBe(PROMPT_ASSETS['prompt-coding-assistant-v1']);

    const unknownFallback = resolveSystemPromptAsset('non-existent-prompt-id');
    expect(unknownFallback).toBe(PROMPT_ASSETS['prompt-general-assistant-v1']);
  });
});
