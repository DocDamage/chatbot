/**
 * Knowledge Router Schemas and Types (CRK-P08-T01, T02, T03, T05)
 *
 * Defines the routing domains, routing policies, user overrides,
 * readiness handling, and telemetry structures for the knowledge subsystem.
 */

import { z } from 'zod';

export const ROUTING_DOMAINS = [
  'coding',
  'coding_debug',
  'repository',
  'game_dev',
  'web_dev',
  'database',
  'devops',
  'general',
  'history',
  'science',
  'research',
  'math',
  'market',
  'six_sigma',
  'creative_reference',
] as const;

export const routingDomainSchema = z.enum(ROUTING_DOMAINS);
export type RoutingDomain = z.infer<typeof routingDomainSchema>;

export const userKnowledgeOverridesSchema = z.object({
  mode: z.enum(['auto', 'custom']).default('auto'),
  includePacks: z.array(z.string()).optional(),
  excludePacks: z.array(z.string()).optional(),
  noOnline: z.boolean().optional().default(false),
});

export type UserKnowledgeOverrides = z.infer<typeof userKnowledgeOverridesSchema>;
export type UserKnowledgeOverridesInput = z.input<typeof userKnowledgeOverridesSchema>;

export const domainRoutePolicySchema = z.object({
  domain: routingDomainSchema,
  packPrecedence: z.array(z.string()),
  allowOnlineFallback: z.boolean().default(false),
  description: z.string().optional(),
});

export type DomainRoutePolicy = z.infer<typeof domainRoutePolicySchema>;

export const routingDecisionSchema = z.object({
  domain: routingDomainSchema,
  candidatePacks: z.array(z.string()),
  selectedPacks: z.array(z.string()),
  unavailablePacks: z.array(z.string()).default([]),
  allowWeb: z.boolean(),
  overridesApplied: z.boolean(),
  telemetry: z.object({
    evaluatedAt: z.string(),
    durationMs: z.number().nonnegative(),
    domain: routingDomainSchema,
    requestedPacks: z.array(z.string()),
    resolvedPacks: z.array(z.string()),
    missingPacks: z.array(z.string()),
    noOnlinePreference: z.boolean(),
  }),
});

export type RoutingDecision = z.infer<typeof routingDecisionSchema>;
