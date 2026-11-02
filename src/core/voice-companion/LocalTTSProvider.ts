/**
 * Local TTS Provider Abstraction (PX12-T03)
 *
 * Provides text-to-speech synthesis with local OS and Kokoro-compatible voices,
 * explicit synthetic media disclosure, latency tracking, and cloud egress gating.
 */

import {
  TTSProviderType,
  TTSSynthesisOptions,
  TTSSynthesisResult
} from './VoiceCompanionTypes';

export interface VoiceDescriptor {
  voiceId: string;
  displayName: string;
  gender: 'female' | 'male' | 'neutral';
  language: string;
  provider: TTSProviderType;
  isLocalOnly: boolean;
  model: string;
  isAvailable?: boolean;
}

export interface LocalTTSBackend {
  synthesize(
    text: string,
    voice: VoiceDescriptor,
    options: TTSSynthesisOptions
  ): Promise<{ audioBuffer: Buffer; durationSec: number; sampleRate: number }>;
  supportsVoice?(voice: VoiceDescriptor): boolean;
}

export class LocalTTSProvider {
  private readonly backend?: LocalTTSBackend;
  private registeredVoices: VoiceDescriptor[] = [
    {
      voiceId: 'kokoro-af-bella',
      displayName: 'Bella (Kokoro Local)',
      gender: 'female',
      language: 'en-US',
      provider: 'kokoro_local',
      isLocalOnly: true,
      model: 'kokoro-v0.19'
    },
    {
      voiceId: 'kokoro-am-adam',
      displayName: 'Adam (Kokoro Local)',
      gender: 'male',
      language: 'en-US',
      provider: 'kokoro_local',
      isLocalOnly: true,
      model: 'kokoro-v0.19'
    },
    {
      voiceId: 'os-native-default',
      displayName: 'System Default Voice',
      gender: 'neutral',
      language: 'en-US',
      provider: 'os_native',
      isLocalOnly: true,
      model: 'win32-sapi'
    },
    {
      voiceId: 'cloud-elevenlabs-rachel',
      displayName: 'Rachel (Cloud Remote)',
      gender: 'female',
      language: 'en-US',
      provider: 'cloud_elevenlabs',
      isLocalOnly: false,
      model: 'eleven_multilingual_v2'
    }
  ];

  constructor(backend?: LocalTTSBackend) {
    this.backend = backend;
  }

  public isAvailable(): boolean {
    return this.registeredVoices.some(voice => this.isVoiceAvailable(voice));
  }

  public listVoices(): VoiceDescriptor[] {
    return this.registeredVoices.map(voice => ({ ...voice, isAvailable: this.isVoiceAvailable(voice) }));
  }

  public getVoice(voiceId: string): VoiceDescriptor | undefined {
    return this.registeredVoices.find(v => v.voiceId === voiceId);
  }

  /**
   * Synthesizes speech from text.
   * Remote cloud voices require explicit `isApprovedEgress === true` consent.
   */
  public async synthesize(
    text: string,
    options: TTSSynthesisOptions
  ): Promise<TTSSynthesisResult> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text to synthesize cannot be empty.');
    }

    const requestedVoice = this.getVoice(options.voiceId);
    const voice = requestedVoice && this.isVoiceAvailable(requestedVoice)
      ? requestedVoice
      : this.registeredVoices.find(candidate => this.isVoiceAvailable(candidate)) || requestedVoice || this.registeredVoices[0];

    // Gating check for cloud voices
    if (!voice.isLocalOnly && !options.isApprovedEgress) {
      throw new Error(
        `Cloud voice "${voice.displayName}" requires explicit data-egress approval before audio synthesis.`
      );
    }

    if (!this.backend) {
      throw new Error(`TTS_BACKEND_UNAVAILABLE: ${voice.displayName} has no configured synthesis backend.`);
    }
    const synthesis = await this.backend.synthesize(text, voice, options);

    const syntheticDisclosure = `AI-generated audio using ${voice.displayName} (${voice.model}). Not a real human voice.`;

    return {
      audioBuffer: synthesis.audioBuffer,
      durationSec: synthesis.durationSec,
      sampleRate: synthesis.sampleRate,
      voiceId: voice.voiceId,
      provider: voice.provider,
      syntheticDisclosureNotice: syntheticDisclosure,
      isLocalOnly: voice.isLocalOnly
    };
  }

  private isVoiceAvailable(voice: VoiceDescriptor): boolean {
    return Boolean(this.backend && (this.backend.supportsVoice?.(voice) ?? true));
  }
}
