/**
 * Floating Assistant Service (PX12-T06)
 *
 * Coordinates floating desktop companion panel states, loopback token auth,
 * multi-turn voice/text dialogs, streaming responses, and speech playback interruption.
 */

import crypto from 'node:crypto';
import { LocalSTTProvider } from './LocalSTTProvider';
import { LocalTTSProvider } from './LocalTTSProvider';

export interface FloatingPanelSession {
  sessionId: string;
  loopbackToken: string;
  isAlwaysOnTop: boolean;
  isSpeaking: boolean;
  activeProvider: string;
  activeModel: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>;
  createdAt: string;
}

export class FloatingAssistantService {
  private activeSession: FloatingPanelSession | null = null;
  private sttProvider: LocalSTTProvider;
  private ttsProvider: LocalTTSProvider;

  constructor(stt?: LocalSTTProvider, tts?: LocalTTSProvider) {
    this.sttProvider = stt || new LocalSTTProvider();
    this.ttsProvider = tts || new LocalTTSProvider();
  }

  public initializeSession(initialConfig: { isAlwaysOnTop?: boolean; provider?: string; model?: string } = {}): FloatingPanelSession {
    const sessionId = `desk-session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const loopbackToken = crypto.randomBytes(24).toString('hex');

    this.activeSession = {
      sessionId,
      loopbackToken,
      isAlwaysOnTop: initialConfig.isAlwaysOnTop ?? true,
      isSpeaking: false,
      activeProvider: initialConfig.provider || 'local_whisper_kokoro',
      activeModel: initialConfig.model || 'base_en',
      conversationHistory: [],
      createdAt: new Date().toISOString()
    };

    return this.activeSession;
  }

  public getSession(): FloatingPanelSession | null {
    return this.activeSession;
  }

  public validateLoopbackToken(token: string): boolean {
    if (!this.activeSession) return false;
    return this.activeSession.loopbackToken === token;
  }

  public setAlwaysOnTop(isAlwaysOnTop: boolean): void {
    if (this.activeSession) {
      this.activeSession.isAlwaysOnTop = isAlwaysOnTop;
    }
  }

  public stopSpeaking(): void {
    if (this.activeSession) {
      this.activeSession.isSpeaking = false;
    }
  }

  public async handleVoiceQuery(
    audioBuffer: Buffer,
    queryHandler: (userText: string) => Promise<string>
  ): Promise<{ userText: string; assistantText: string; audioResponse?: Buffer }> {
    if (!this.activeSession) {
      this.initializeSession();
    }

    // Transcribe
    const stt = await this.sttProvider.transcribe(audioBuffer);
    const userText = stt.text;

    this.activeSession!.conversationHistory.push({
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString()
    });

    // Execute query handler
    const assistantText = await queryHandler(userText);

    this.activeSession!.conversationHistory.push({
      role: 'assistant',
      text: assistantText,
      timestamp: new Date().toISOString()
    });

    // Synthesize response audio
    this.activeSession!.isSpeaking = true;
    const tts = await this.ttsProvider.synthesize(assistantText, {
      voiceId: 'kokoro-af-bella'
    });

    return {
      userText,
      assistantText,
      audioResponse: tts.audioBuffer
    };
  }
}
