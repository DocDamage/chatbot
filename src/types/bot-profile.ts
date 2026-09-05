/**
 * Bot Profile & Versioned Configuration Types (CRK Phase 02)
 *
 * Defines explicit configuration contracts for chatbot personalities, response styles,
 * and policy bindings. In accordance with CRK Phase 02 security rules, profiles must
 * never store API secrets, keys, or credentials (§907).
 */

import { z } from 'zod';

export const responseStyleSchema = z.enum(['adaptive', 'concise', 'detailed']);
export type ResponseStyle = z.infer<typeof responseStyleSchema>;

export const citationPolicySchema = z.enum(['auto', 'always-when-grounded', 'off']);
export type CitationPolicy = z.infer<typeof citationPolicySchema>;

export const baseBotProfileSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Profile ID must be alphanumeric with dashes/underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  version: z.number().int().positive().default(1),
  systemPolicyId: z.string().min(1).max(100).default('default-policy'),
  systemPromptAssetId: z.string().max(100).optional(),
  responseStyle: responseStyleSchema.default('adaptive'),
  knowledgePolicyId: z.string().min(1).max(100).default('default'),
  modelPolicyId: z.string().min(1).max(100).default('default'),
  memoryPolicyId: z.string().min(1).max(100).default('default'),
  toolPolicyId: z.string().min(1).max(100).default('default'),
  citationPolicy: citationPolicySchema.default('auto'),
  enabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime().or(z.string()),
  updatedAt: z.string().datetime().or(z.string()),
});

export const botProfileSchema = baseBotProfileSchema.strict().superRefine((data, ctx) => {
  const forbiddenSecretKeys = ['apiKey', 'secret', 'token', 'password', 'privateKey', 'auth'];
  for (const key of Object.keys(data)) {
    if (forbiddenSecretKeys.some(forbidden => key.toLowerCase().includes(forbidden.toLowerCase()))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Security violation: BotProfile must not store secrets or credentials (${key})`,
        path: [key],
      });
    }
  }
});

export type BotProfile = z.infer<typeof botProfileSchema>;
export type BotProfileInput = z.input<typeof botProfileSchema>;

export const botProfileVersionSchema = z.object({
  profileId: z.string().min(1).max(100),
  version: z.number().int().positive(),
  previousVersion: z.number().int().positive().optional(),
  changedFields: z.array(z.string()).default([]),
  author: z.string().min(1).max(100),
  timestamp: z.string().datetime().or(z.string()),
  activationState: z.enum(['active', 'archived', 'draft']).default('active'),
  rolloutPercentage: z.number().min(0).max(100).default(100),
  snapshot: botProfileSchema,
});

export type BotProfileVersion = z.infer<typeof botProfileVersionSchema>;
