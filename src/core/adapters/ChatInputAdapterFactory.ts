/**
 * Chat Input Adapter Factory (CRK-P22-T01, T04)
 *
 * Provides a unified registry for external input channels (web, voice, integration, companion).
 * Ensures all external messages funnel into the canonical NormalizedChatRequest.
 */

import { randomUUID } from 'crypto';
import { NormalizedChatRequest } from '../../types/chat-runtime';
import {
  ChatInputAdapter,
  IntegrationMessagePayload,
  integrationMessagePayloadSchema,
} from '../../types/input-adapters';
import { ChatRequestNormalizer } from '../chat/ChatRequestNormalizer';
import { VoiceInputAdapter } from './VoiceInputAdapter';

export class WebTextInputAdapter implements ChatInputAdapter {
  public readonly adapterId = 'web-text-adapter';
  public readonly channel = 'web' as const;

  public async normalize(input: unknown): Promise<NormalizedChatRequest> {
    return ChatRequestNormalizer.normalize(input);
  }
}

export class IntegrationMessageAdapter implements ChatInputAdapter {
  public readonly adapterId = 'integration-message-adapter';
  public readonly channel = 'integration' as const;

  public async normalize(input: unknown): Promise<NormalizedChatRequest> {
    const parsed = integrationMessagePayloadSchema.parse(input);
    const requestId = `req-integ-${randomUUID().slice(0, 8)}`;

    return ChatRequestNormalizer.normalize({
      requestId,
      sessionId: `sess-integ-${parsed.channelId}`,
      userId: parsed.senderId,
      message: parsed.content,
      metadata: {
        entryChannel: 'integration',
        sourceSystem: parsed.sourceSystem,
        externalMessageId: parsed.externalMessageId,
        ...parsed.metadata,
      },
    });
  }
}

export class DesktopCompanionAdapter implements ChatInputAdapter {
  public readonly adapterId = 'desktop-companion-adapter';
  public readonly channel = 'desktop_companion' as const;

  public async normalize(input: unknown): Promise<NormalizedChatRequest> {
    const raw = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
    const requestId = `req-comp-${randomUUID().slice(0, 8)}`;

    return ChatRequestNormalizer.normalize({
      requestId,
      sessionId: (raw.sessionId as string) || `sess-comp-${randomUUID().slice(0, 8)}`,
      userId: raw.userId as string | undefined,
      message: (raw.message as string) || (raw.prompt as string) || '',
      metadata: {
        entryChannel: 'desktop_companion',
        companionAppVersion: raw.companionVersion || '1.0.0',
      },
    });
  }
}

export class ChatInputAdapterFactory {
  private static readonly adapters = new Map<string, ChatInputAdapter>([
    ['web', new WebTextInputAdapter()],
    ['voice', new VoiceInputAdapter()],
    ['integration', new IntegrationMessageAdapter()],
    ['desktop_companion', new DesktopCompanionAdapter()],
  ]);

  public static getAdapter(channel: 'web' | 'voice' | 'integration' | 'desktop_companion'): ChatInputAdapter {
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`ADAPTER_NOT_FOUND: No adapter registered for channel '${channel}'`);
    }
    return adapter;
  }

  public static registerAdapter(adapter: ChatInputAdapter): void {
    this.adapters.set(adapter.channel, adapter);
  }
}
