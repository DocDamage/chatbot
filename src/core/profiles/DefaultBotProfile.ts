/**
 * Default Bot Profiles & Prompt Asset Registry (CRK-P02-T03)
 *
 * Provides source-controlled default profiles capturing current intended assistant
 * behavior, referencing prompt assets rather than embedding massive prompt literals (§930-936).
 */

import { BotProfile, botProfileSchema } from '../../types/bot-profile';

export const PROMPT_ASSETS: Record<string, string> = {
  'prompt-general-assistant-v1': `You are an expert AI assistant with comprehensive capabilities across software development, scientific reasoning, mathematics, research, and creative writing.
Provide accurate, structured, and factual responses. When information is retrieved from grounding sources, cite your sources accurately. If facts are unknown or evidence is insufficient, state the limitation clearly.`,

  'prompt-coding-assistant-v1': `You are a Principal Software Engineer and System Architect.
Write clean, performant, type-safe, and well-tested code following repository standards and architectural patterns. Focus on correctness, security, and edge-case handling.`,

  'prompt-research-assistant-v1': `You are a Senior Research Analyst and Fact-Checker.
Synthesize verified knowledge, compare differing perspectives objectively, and prioritize authoritative, primary sources.`,
};

export function resolveSystemPromptAsset(assetId?: string): string {
  if (!assetId) {
    return PROMPT_ASSETS['prompt-general-assistant-v1'];
  }
  return PROMPT_ASSETS[assetId] || PROMPT_ASSETS['prompt-general-assistant-v1'];
}

export const DEFAULT_BOT_PROFILE: BotProfile = botProfileSchema.parse({
  id: 'default',
  name: 'General Assistant',
  description: 'Canonical default assistant for reasoning, coding, research, and conversation.',
  version: 1,
  systemPolicyId: 'general-assistant-policy-v1',
  systemPromptAssetId: 'prompt-general-assistant-v1',
  responseStyle: 'adaptive',
  knowledgePolicyId: 'default-knowledge',
  modelPolicyId: 'balanced-model-policy',
  memoryPolicyId: 'default-memory-policy',
  toolPolicyId: 'standard-tools-policy',
  citationPolicy: 'auto',
  enabled: true,
  isDefault: true,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
});

export const CODING_BOT_PROFILE: BotProfile = botProfileSchema.parse({
  id: 'coding',
  name: 'Coding & Architecture Assistant',
  description: 'Specialized profile for coding, refactoring, and software architecture.',
  version: 1,
  systemPolicyId: 'coding-assistant-policy-v1',
  systemPromptAssetId: 'prompt-coding-assistant-v1',
  responseStyle: 'adaptive',
  knowledgePolicyId: 'coding-docs-knowledge',
  modelPolicyId: 'coding-quality-policy',
  memoryPolicyId: 'coding-workspace-memory',
  toolPolicyId: 'coding-tools-policy',
  citationPolicy: 'always-when-grounded',
  enabled: true,
  isDefault: false,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
});

export const RESEARCH_BOT_PROFILE: BotProfile = botProfileSchema.parse({
  id: 'research',
  name: 'Research & Fact-Checking Assistant',
  description: 'Specialized profile for authoritative research, analysis, and citations.',
  version: 1,
  systemPolicyId: 'research-assistant-policy-v1',
  systemPromptAssetId: 'prompt-research-assistant-v1',
  responseStyle: 'detailed',
  knowledgePolicyId: 'research-authoritative-knowledge',
  modelPolicyId: 'research-model-policy',
  memoryPolicyId: 'default-memory-policy',
  toolPolicyId: 'search-tools-policy',
  citationPolicy: 'always-when-grounded',
  enabled: true,
  isDefault: false,
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
});

export const BUILTIN_PROFILES: BotProfile[] = [
  DEFAULT_BOT_PROFILE,
  CODING_BOT_PROFILE,
  RESEARCH_BOT_PROFILE,
];
