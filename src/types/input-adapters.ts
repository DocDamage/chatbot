/**
 * Voice and External Input/Output Adapter Contracts (CRK-P22-T01 to T05)
 *
 * Defines typed contracts for external entry points (voice, STT, TTS, integrations, companion),
 * ensuring all channels normalize into the canonical NormalizedChatRequest with explicit privacy controls.
 */

import { z } from 'zod';
import { NormalizedChatRequest } from './chat-runtime';

export interface ChatInputAdapter {
  adapterId: string;
  channel: 'web' | 'voice' | 'integration' | 'desktop_companion';
  normalize(input: unknown): Promise<NormalizedChatRequest>;
}

export const audioRetentionPolicySchema = z.object({
  retainAudio: z.boolean().default(false),
  retentionTtlSeconds: z.number().int().nonnegative().default(0),
  allowServerSideStorage: z.boolean().default(false),
});

export type AudioRetentionPolicy = z.infer<typeof audioRetentionPolicySchema>;

export const speechToTextMetadataSchema = z.object({
  sttProvider: z.string().min(1),
  sttModel: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  languageDetected: z.string().optional(),
  audioDurationSec: z.number().nonnegative().optional(),
  rawTranscript: z.string().min(1),
  userEdited: z.boolean().default(false),
});

export type SpeechToTextMetadata = z.infer<typeof speechToTextMetadataSchema>;

export const voiceInputPayloadSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  microphoneConsent: z.boolean(),
  audioBufferBase64: z.string().optional(),
  transcript: z.string().optional(),
  sttMetadata: speechToTextMetadataSchema.optional(),
  privacyPolicy: audioRetentionPolicySchema.default({
    retainAudio: false,
    retentionTtlSeconds: 0,
    allowServerSideStorage: false,
  }),
});

export type VoiceInputPayload = z.infer<typeof voiceInputPayloadSchema>;

export const textToSpeechRequestSchema = z.object({
  requestId: z.string().min(1),
  text: z.string().min(1),
  voiceId: z.string().default('default-assistant'),
  speechRate: z.number().min(0.5).max(2.0).default(1.0),
  outputFormat: z.enum(['mp3', 'wav', 'opus']).default('mp3'),
});

export type TextToSpeechRequest = z.infer<typeof textToSpeechRequestSchema>;

export const textToSpeechResultSchema = z.object({
  requestId: z.string().min(1),
  originalText: z.string().min(1),
  audioUrl: z.string().optional(),
  audioBase64: z.string().optional(),
  durationSec: z.number().nonnegative(),
  voiceModel: z.string().min(1),
  unalteredResponseText: z.string().min(1),
});

export type TextToSpeechResult = z.infer<typeof textToSpeechResultSchema>;

export const integrationMessagePayloadSchema = z.object({
  sourceSystem: z.string().min(1),
  externalMessageId: z.string().min(1),
  senderId: z.string().min(1),
  channelId: z.string().min(1),
  content: z.string().min(1),
  attachments: z.array(z.object({
    type: z.string(),
    url: z.string(),
    name: z.string().optional(),
  })).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export type IntegrationMessagePayload = z.infer<typeof integrationMessagePayloadSchema>;
