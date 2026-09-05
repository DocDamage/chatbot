/**
 * Section 42: API and Type Compatibility Strategy
 * Types and schemas governing legacy bridge mapping, client versioning, and deprecation lifecycle.
 */
import { z } from 'zod';
import { NormalizedChatRequest, ChatRuntimeResult } from './chat-runtime';

export type ApiClientVersion = 'v1_legacy' | 'v2_canonical' | 'v2_canary';

export const ApiClientVersionSchema = z.enum([
  'v1_legacy',
  'v2_canonical',
  'v2_canary',
]);

export interface LegacyChatRequestPayload {
  prompt?: string;
  message?: string;
  userId?: string;
  sessionId?: string;
  conversationId?: string;
  options?: {
    model?: string;
    temperature?: number;
    useRag?: boolean;
    stream?: boolean;
  };
}

export interface LegacyChatResponsePayload {
  response: string;
  sessionId?: string;
  conversationId?: string;
  model?: string;
  // Modern additions conditionally included based on version
  citations?: Array<{ source: string; snippet?: string }>;
  grounding?: { confidence: number; supported: boolean };
  toolResults?: Array<{ toolName: string; status: string }>;
  traceId?: string;
  apiVersion: ApiClientVersion;
}

export interface ClientNegotiationInfo {
  version: ApiClientVersion;
  isLegacy: boolean;
  warnings?: string[];
  deprecationNotice?: string;
}

export interface DeprecationPolicyCheck {
  apiVersion: ApiClientVersion;
  sunsetDate: string;
  clientMigrated: boolean;
  apiConsumersIdentified: boolean;
  deprecationDocumented: boolean;
  releaseWindowElapsed: boolean;
  canDecommission: boolean;
  blockingReasons: string[];
}

export const LegacyChatRequestSchema = z.object({
  prompt: z.string().optional(),
  message: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  options: z
    .object({
      model: z.string().optional(),
      temperature: z.number().optional(),
      useRag: z.boolean().optional(),
      stream: z.boolean().optional(),
    })
    .optional(),
});
