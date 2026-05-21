import { z } from 'zod';
import { AIContract } from './contract';
import { creativeRequestSchema } from '../core/creative/CreativeTypes';

export const loadedFileContextSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  language: z.string().optional(),
  size: z.number().optional(),
}).passthrough();

export const loadedAudioContextSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  format: z.string().optional(),
  duration: z.number().optional(),
  sampleRate: z.number().optional(),
  channels: z.number().optional(),
}).passthrough();

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000).trim(),
  sessionId: z.string().min(1).max(100),
  userId: z.string().max(100).optional(),
  mode: z.string().max(100).optional(),
  systemPrompt: z.string().max(8000).optional(),
  loadedFiles: z.array(loadedFileContextSchema).max(20).optional(),
  loadedAudio: z.array(loadedAudioContextSchema).max(20).optional(),
  activePlanId: z.string().max(200).optional(),
  activePlanContent: z.string().max(50000).optional(),
  activeFileBrowserMode: z.string().max(100).optional(),
  creative: creativeRequestSchema.omit({ prompt: true }).partial().optional(),
  contract: z.any().optional(),
});

export type LoadedFileContextDto = z.infer<typeof loadedFileContextSchema>;
export type LoadedAudioContextDto = z.infer<typeof loadedAudioContextSchema>;

export interface ChatRequestDto {
  message: string;
  sessionId: string;
  userId?: string;
  mode?: string;
  systemPrompt?: string;
  loadedFiles?: LoadedFileContextDto[];
  loadedAudio?: LoadedAudioContextDto[];
  activePlanId?: string;
  activePlanContent?: string;
  activeFileBrowserMode?: string;
  creative?: Partial<Omit<z.infer<typeof creativeRequestSchema>, 'prompt'>>;
  contract?: AIContract;
}

export interface ChatContextBundle {
  systemInstruction?: string;
  plan?: {
    id: string;
    content: string;
  };
  files: Array<{
    path: string;
    content: string;
  }>;
  audio: LoadedAudioContextDto[];
}

export function buildChatContextBundle(request: ChatRequestDto): ChatContextBundle {
  return {
    systemInstruction: request.systemPrompt?.trim() || undefined,
    plan: request.activePlanId && request.activePlanContent
      ? {
          id: request.activePlanId,
          content: request.activePlanContent,
        }
      : undefined,
    files: (request.loadedFiles || [])
      .map(file => ({
        path: file.path,
        content: String(file.content || file.excerpt || '').slice(0, 12000),
      }))
      .filter(file => file.content.trim().length > 0),
    audio: request.loadedAudio || [],
  };
}

export function renderChatContext(bundle: ChatContextBundle): string {
  const sections: string[] = [];

  if (bundle.systemInstruction) {
    sections.push(`System instruction:\n${bundle.systemInstruction}`);
  }

  if (bundle.plan) {
    sections.push(`Active implementation plan (${bundle.plan.id}):\n${bundle.plan.content.slice(0, 20000)}`);
  }

  if (bundle.files.length > 0) {
    sections.push([
      'Loaded workspace files:',
      ...bundle.files.map(file => `--- ${file.path} ---\n${file.content}`),
    ].join('\n'));
  }

  if (bundle.audio.length > 0) {
    sections.push([
      'Loaded audio context:',
      ...bundle.audio.map(audio => `- ${audio.path}${audio.duration ? ` (${audio.duration}s)` : ''}`),
    ].join('\n'));
  }

  return sections.join('\n\n');
}
