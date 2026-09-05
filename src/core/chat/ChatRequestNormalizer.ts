/**
 * Canonical Chat Request Normalizer
 *
 * Sanitizes and normalizes incoming chat payloads from any entry point
 * (REST, streaming, CLI, or internal adapters) into a canonical NormalizedChatRequest.
 * Enforces security boundaries, deduplicates contexts, and prevents prototype pollution.
 */

import { randomUUID } from 'crypto';
import {
  NormalizedChatRequest,
  normalizedChatRequestSchema,
  LoadedFileContext,
  LoadedAudioContext,
  ActivePlanContext,
  ClientCapabilities,
} from '../../types/chat-runtime';

export class ChatRequestNormalizationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'VALIDATION_ERROR',
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChatRequestNormalizationError';
  }
}

export interface ChatServerContext {
  userId?: string;
  requestId?: string;
  defaultBotProfileId?: string;
  authenticated?: boolean;
}

export interface ChatNormalizationOptions {
  maxMessageLength?: number;
  maxFilesCount?: number;
  maxAudioCount?: number;
  maxFileContentLength?: number;
  maxSystemInstructionLength?: number;
  maxActivePlanLength?: number;
}

const DEFAULTS: Required<ChatNormalizationOptions> = {
  maxMessageLength: 50000,
  maxFilesCount: 50,
  maxAudioCount: 20,
  maxFileContentLength: 25000,
  maxSystemInstructionLength: 16000,
  maxActivePlanLength: 100000,
};

export class ChatRequestNormalizer {
  public static normalize(
    raw: unknown,
    serverContext?: ChatServerContext,
    options?: ChatNormalizationOptions
  ): NormalizedChatRequest {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ChatRequestNormalizationError(
        'Invalid chat request: payload must be a non-null object',
        'INVALID_PAYLOAD'
      );
    }

    const opts = { ...DEFAULTS, ...options };
    const input = raw as Record<string, unknown>;

    const message = this.validateMessage(input.message, opts.maxMessageLength);
    const sessionId = this.validateSessionId(input.sessionId);
    const requestId = this.resolveRequestId(input.requestId, serverContext);
    const userId = this.resolveUserId(input.userId, serverContext);
    const botProfileId = this.resolveBotProfileId(input.botProfileId, serverContext);
    const mode = this.cleanString(input.mode, 100);
    const explicitSystemInstruction = this.cleanString(
      input.explicitSystemInstruction ?? input.systemPrompt,
      opts.maxSystemInstructionLength
    );
    const loadedFiles = this.normalizeLoadedFiles(input.loadedFiles, opts);
    const loadedAudio = this.normalizeLoadedAudio(input.loadedAudio, opts.maxAudioCount);
    const activePlan = this.resolveActivePlan(input, opts.maxActivePlanLength);
    const clientCapabilities = this.normalizeClientCapabilities(input.clientCapabilities);
    const requestedModelPolicy = this.cleanString(input.requestedModelPolicy, 100);
    const metadata = this.sanitizeMetadata(input.metadata);

    const draft = {
      requestId,
      sessionId,
      userId,
      message,
      mode,
      botProfileId,
      explicitSystemInstruction,
      loadedFiles,
      loadedAudio,
      activePlan,
      clientCapabilities,
      requestedModelPolicy,
      metadata,
    };

    try {
      return normalizedChatRequestSchema.parse(draft);
    } catch (err: unknown) {
      throw new ChatRequestNormalizationError(
        `Failed schema validation: ${(err as Error).message}`,
        'SCHEMA_VALIDATION_FAILED',
        { originalError: err }
      );
    }
  }

  public normalize(
    raw: unknown,
    serverContext?: ChatServerContext,
    options?: ChatNormalizationOptions
  ): NormalizedChatRequest {
    return ChatRequestNormalizer.normalize(raw, serverContext, options);
  }

  private static validateMessage(rawMessage: unknown, maxLength: number): string {
    if (typeof rawMessage !== 'string') {
      throw new ChatRequestNormalizationError('Message is required and must be a string', 'EMPTY_MESSAGE');
    }
    const trimmed = rawMessage.trim();
    if (trimmed.length === 0) {
      throw new ChatRequestNormalizationError('Message cannot be empty or only whitespace', 'EMPTY_MESSAGE');
    }
    if (rawMessage.length > maxLength) {
      throw new ChatRequestNormalizationError(
        `Message exceeds maximum permitted length of ${maxLength} characters (received ${rawMessage.length})`,
        'MESSAGE_TOO_LONG',
        { maxLength, receivedLength: rawMessage.length }
      );
    }
    return trimmed;
  }

  private static validateSessionId(rawSessionId: unknown): string {
    if (typeof rawSessionId !== 'string' || rawSessionId.trim().length === 0) {
      throw new ChatRequestNormalizationError('sessionId is required and cannot be empty', 'MISSING_SESSION');
    }
    return rawSessionId.trim().slice(0, 128);
  }

  private static resolveRequestId(clientReqId: unknown, ctx?: ChatServerContext): string {
    if (ctx?.requestId && ctx.requestId.trim().length > 0) return ctx.requestId.trim().slice(0, 128);
    if (typeof clientReqId === 'string' && clientReqId.trim().length > 0) return clientReqId.trim().slice(0, 128);
    return `req_${randomUUID()}`;
  }

  private static resolveUserId(clientUserId: unknown, ctx?: ChatServerContext): string | undefined {
    if (ctx?.userId !== undefined) {
      const trimmed = ctx.userId.trim();
      return trimmed.length > 0 ? trimmed.slice(0, 128) : undefined;
    }
    return typeof clientUserId === 'string' && clientUserId.trim().length > 0
      ? clientUserId.trim().slice(0, 128)
      : undefined;
  }

  private static resolveBotProfileId(clientProfileId: unknown, ctx?: ChatServerContext): string {
    if (typeof clientProfileId === 'string' && clientProfileId.trim().length > 0) {
      return clientProfileId.trim().slice(0, 100);
    }
    if (ctx?.defaultBotProfileId && ctx.defaultBotProfileId.trim().length > 0) {
      return ctx.defaultBotProfileId.trim().slice(0, 100);
    }
    return 'default';
  }

  private static cleanString(val: unknown, maxLen: number): string | undefined {
    if (typeof val !== 'string') return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed.slice(0, maxLen) : undefined;
  }

  private static normalizeLoadedFiles(
    files: unknown,
    opts: Required<ChatNormalizationOptions>
  ): LoadedFileContext[] {
    if (!Array.isArray(files)) return [];
    const deduplicated = new Map<string, LoadedFileContext>();

    for (const item of files) {
      if (!item || typeof item !== 'object' || typeof (item as { path?: unknown }).path !== 'string') continue;
      const raw = item as Record<string, unknown>;
      const normPath = String(raw.path).trim();
      if (normPath.length === 0 || deduplicated.has(normPath)) continue;

      deduplicated.set(normPath, {
        path: normPath,
        content: typeof raw.content === 'string' ? raw.content.slice(0, opts.maxFileContentLength) : undefined,
        excerpt: typeof raw.excerpt === 'string' ? raw.excerpt.slice(0, opts.maxFileContentLength) : undefined,
        language: typeof raw.language === 'string' ? raw.language.trim().slice(0, 50) : undefined,
        size: typeof raw.size === 'number' && raw.size >= 0 ? raw.size : undefined,
      });
    }
    return Array.from(deduplicated.values()).slice(0, opts.maxFilesCount);
  }

  private static normalizeLoadedAudio(audioList: unknown, maxCount: number): LoadedAudioContext[] {
    if (!Array.isArray(audioList)) return [];
    const deduplicated = new Map<string, LoadedAudioContext>();

    for (const item of audioList) {
      if (!item || typeof item !== 'object' || typeof (item as { path?: unknown }).path !== 'string') continue;
      const raw = item as Record<string, unknown>;
      const normPath = String(raw.path).trim();
      if (normPath.length === 0 || deduplicated.has(normPath)) continue;

      deduplicated.set(normPath, {
        path: normPath,
        name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 100) : undefined,
        format: typeof raw.format === 'string' ? raw.format.trim().slice(0, 20) : undefined,
        duration: typeof raw.duration === 'number' && raw.duration >= 0 ? raw.duration : undefined,
        sampleRate: typeof raw.sampleRate === 'number' && raw.sampleRate > 0 ? raw.sampleRate : undefined,
        channels: typeof raw.channels === 'number' && Number.isInteger(raw.channels) && raw.channels > 0 ? raw.channels : undefined,
      });
    }
    return Array.from(deduplicated.values()).slice(0, maxCount);
  }

  private static resolveActivePlan(
    input: Record<string, unknown>,
    maxPlanLen: number
  ): ActivePlanContext | undefined {
    if (input.activePlan !== undefined && input.activePlan !== null) {
      if (typeof input.activePlan !== 'object' || Array.isArray(input.activePlan)) {
        throw new ChatRequestNormalizationError('Invalid activePlan structure', 'INVALID_ACTIVE_PLAN');
      }
      const plan = input.activePlan as Record<string, unknown>;
      if (typeof plan.id !== 'string' || plan.id.trim().length === 0 || typeof plan.content !== 'string') {
        throw new ChatRequestNormalizationError(
          'activePlan must contain non-empty string id and string content',
          'INVALID_ACTIVE_PLAN'
        );
      }
      return { id: plan.id.trim().slice(0, 200), content: plan.content.slice(0, maxPlanLen) };
    }

    if (
      typeof input.activePlanId === 'string' &&
      input.activePlanId.trim().length > 0 &&
      typeof input.activePlanContent === 'string'
    ) {
      return { id: input.activePlanId.trim().slice(0, 200), content: input.activePlanContent.slice(0, maxPlanLen) };
    }
    return undefined;
  }

  private static normalizeClientCapabilities(rawCaps: unknown): ClientCapabilities {
    if (!rawCaps || typeof rawCaps !== 'object' || Array.isArray(rawCaps)) {
      return { streaming: false, citations: false, toolApproval: false };
    }
    const caps = rawCaps as Record<string, unknown>;
    return {
      streaming: Boolean(caps.streaming),
      citations: Boolean(caps.citations),
      toolApproval: Boolean(caps.toolApproval),
    };
  }

  private static sanitizeMetadata(rawMetadata: unknown): Record<string, unknown> {
    if (rawMetadata === undefined || rawMetadata === null) return {};
    if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
      throw new ChatRequestNormalizationError('Metadata must be a plain object', 'INVALID_METADATA');
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawMetadata)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = value;
    }
    return sanitized;
  }
}
