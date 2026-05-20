/**
 * Voice Agent
 * Real-time voice RAG agent with speech-to-text and text-to-speech
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface VoiceAgentConfig {
    sttProvider: 'whisper' | 'assemblyai' | 'google';
    ttsProvider: 'native' | 'elevenlabs' | 'cartesia';
    language: string;
    sampleRate: number;
    enableStreaming: boolean;
}

export interface TranscriptionResult {
    text: string;
    confidence: number;
    words?: WordTiming[];
    language?: string;
    duration: number;
}

export interface WordTiming {
    word: string;
    start: number;
    end: number;
    confidence: number;
}

export interface SynthesisResult {
    audioBuffer: Buffer;
    duration: number;
    sampleRate: number;
}

export interface VoiceConversation {
    id: string;
    turns: VoiceTurn[];
    startedAt: Date;
    lastActivityAt: Date;
}

export interface VoiceTurn {
    role: 'user' | 'assistant';
    audio?: Buffer;
    text: string;
    timestamp: Date;
}

export class VoiceAgent {
    private config: VoiceAgentConfig;
    private activeConversations: Map<string, VoiceConversation> = new Map();

    constructor(config?: Partial<VoiceAgentConfig>) {
        this.config = {
            sttProvider: 'whisper',
            ttsProvider: 'native',
            language: 'en',
            sampleRate: 16000,
            enableStreaming: true,
            ...config
        };
    }

    /**
     * Transcribe audio to text
     */
    async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
        const startTime = Date.now();

        logger.info('Transcribing audio', {
            size: audioBuffer.length,
            provider: this.config.sttProvider
        });

        try {
            switch (this.config.sttProvider) {
                case 'whisper':
                    return await this.transcribeWithWhisper(audioBuffer);
                case 'assemblyai':
                    return await this.transcribeWithAssemblyAI(audioBuffer);
                case 'google':
                    return await this.transcribeWithGoogle(audioBuffer);
                default:
                    throw new Error(`Unknown STT provider: ${this.config.sttProvider}`);
            }
        } catch (error: any) {
            logger.error('Transcription failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Synthesize text to speech
     */
    async synthesize(text: string, voice?: string): Promise<SynthesisResult> {
        logger.info('Synthesizing speech', {
            length: text.length,
            provider: this.config.ttsProvider
        });

        try {
            switch (this.config.ttsProvider) {
                case 'native':
                    return await this.synthesizeNative(text, voice);
                case 'elevenlabs':
                    return await this.synthesizeWithElevenLabs(text, voice);
                case 'cartesia':
                    return await this.synthesizeWithCartesia(text, voice);
                default:
                    throw new Error(`Unknown TTS provider: ${this.config.ttsProvider}`);
            }
        } catch (error: any) {
            logger.error('Synthesis failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Process voice input and generate voice response
     */
    async processVoiceQuery(
        audioBuffer: Buffer,
        queryHandler: (text: string) => Promise<string>,
        conversationId?: string
    ): Promise<{ text: string; audio?: Buffer }> {
        // Transcribe
        const transcription = await this.transcribe(audioBuffer);

        if (transcription.confidence < 0.5) {
            logger.warn('Low confidence transcription', {
                confidence: transcription.confidence
            });
        }

        // Track conversation
        if (conversationId) {
            this.addToConversation(conversationId, 'user', transcription.text, audioBuffer);
        }

        // Process query
        const response = await queryHandler(transcription.text);

        // Synthesize response
        let responseAudio: Buffer | undefined;
        try {
            const synthesis = await this.synthesize(response);
            responseAudio = synthesis.audioBuffer;
        } catch (error) {
            logger.warn('TTS synthesis failed, returning text only');
        }

        // Track response
        if (conversationId) {
            this.addToConversation(conversationId, 'assistant', response, responseAudio);
        }

        return { text: response, audio: responseAudio };
    }

    /**
     * Transcribe with Whisper (local or API)
     */
    private async transcribeWithWhisper(audioBuffer: Buffer): Promise<TranscriptionResult> {
        // Use OpenAI Whisper API
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI();

        // Write buffer to temp file (whisper requires file)
        const tempPath = path.join(process.cwd(), `temp_audio_${Date.now()}.wav`);
        fs.writeFileSync(tempPath, audioBuffer);

        try {
            const transcription = await client.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: 'whisper-1',
                language: this.config.language,
                response_format: 'verbose_json'
            });

            return {
                text: transcription.text,
                confidence: 0.9, // Whisper doesn't return confidence
                language: transcription.language,
                duration: transcription.duration || 0
            };
        } finally {
            // Cleanup temp file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    /**
     * Transcribe with AssemblyAI
     */
    private async transcribeWithAssemblyAI(audioBuffer: Buffer): Promise<TranscriptionResult> {
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey) {
            throw new Error('ASSEMBLYAI_API_KEY not set');
        }

        const axios = (await import('axios')).default;

        // Upload audio
        const uploadResponse = await axios.post(
            'https://api.assemblyai.com/v2/upload',
            audioBuffer,
            {
                headers: {
                    'authorization': apiKey,
                    'content-type': 'application/octet-stream'
                }
            }
        );

        const uploadUrl = uploadResponse.data.upload_url;

        // Start transcription
        const transcriptResponse = await axios.post(
            'https://api.assemblyai.com/v2/transcript',
            {
                audio_url: uploadUrl,
                language_code: this.config.language
            },
            {
                headers: { 'authorization': apiKey }
            }
        );

        const transcriptId = transcriptResponse.data.id;

        // Poll for completion
        let transcript;
        while (!transcript || transcript.status !== 'completed') {
            const statusResponse = await axios.get(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { 'authorization': apiKey } }
            );

            transcript = statusResponse.data;

            if (transcript.status === 'completed') {
                continue;
            } else if (transcript.status === 'error') {
                throw new Error(`Transcription failed: ${transcript.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return {
            text: transcript.text,
            confidence: transcript.confidence || 0.9,
            words: transcript.words?.map((w: any) => ({
                word: w.text,
                start: w.start / 1000,
                end: w.end / 1000,
                confidence: w.confidence
            })),
            duration: transcript.audio_duration || 0
        };
    }

    /**
     * Transcribe with Google Speech-to-Text
     */
    private async transcribeWithGoogle(audioBuffer: Buffer): Promise<TranscriptionResult> {
        // Placeholder for Google Speech-to-Text
        logger.warn('Google STT not fully implemented, using placeholder');

        return {
            text: '[Google Speech-to-Text not configured]',
            confidence: 0,
            duration: 0
        };
    }

    /**
     * Synthesize with native browser TTS (for electron/node-based apps)
     */
    private async synthesizeNative(text: string, voice?: string): Promise<SynthesisResult> {
        // For Node.js, we'll use a simple placeholder
        // In production, integrate with say.js or similar
        logger.info('Native TTS: would speak', { text: text.substring(0, 50) });

        return {
            audioBuffer: Buffer.from([]),
            duration: text.length * 0.05, // Rough estimate
            sampleRate: this.config.sampleRate
        };
    }

    /**
     * Synthesize with ElevenLabs
     */
    private async synthesizeWithElevenLabs(text: string, voice?: string): Promise<SynthesisResult> {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            throw new Error('ELEVENLABS_API_KEY not set');
        }

        const axios = (await import('axios')).default;
        const voiceId = voice || 'EXAVITQu4vr4xnSDxMaL'; // Default voice

        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            },
            {
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return {
            audioBuffer: Buffer.from(response.data),
            duration: text.length * 0.05,
            sampleRate: 22050
        };
    }

    /**
     * Synthesize with Cartesia
     */
    private async synthesizeWithCartesia(text: string, voice?: string): Promise<SynthesisResult> {
        const apiKey = process.env.CARTESIA_API_KEY;
        if (!apiKey) {
            throw new Error('CARTESIA_API_KEY not set');
        }

        const axios = (await import('axios')).default;

        const response = await axios.post(
            'https://api.cartesia.ai/tts/bytes',
            {
                model_id: 'sonic-english',
                transcript: text,
                voice: {
                    mode: 'id',
                    id: voice || 'a0e99841-438c-4a64-b679-ae501e7d6091'
                },
                output_format: {
                    container: 'wav',
                    encoding: 'pcm_f32le',
                    sample_rate: this.config.sampleRate
                }
            },
            {
                headers: {
                    'X-API-Key': apiKey,
                    'Cartesia-Version': '2024-06-10',
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        return {
            audioBuffer: Buffer.from(response.data),
            duration: text.length * 0.05,
            sampleRate: this.config.sampleRate
        };
    }

    /**
     * Start a voice conversation
     */
    startConversation(): string {
        const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        this.activeConversations.set(id, {
            id,
            turns: [],
            startedAt: new Date(),
            lastActivityAt: new Date()
        });

        return id;
    }

    /**
     * Add turn to conversation
     */
    private addToConversation(
        conversationId: string,
        role: 'user' | 'assistant',
        text: string,
        audio?: Buffer
    ): void {
        const conversation = this.activeConversations.get(conversationId);
        if (!conversation) return;

        conversation.turns.push({
            role,
            text,
            audio,
            timestamp: new Date()
        });
        conversation.lastActivityAt = new Date();
    }

    /**
     * Get conversation history
     */
    getConversation(conversationId: string): VoiceConversation | undefined {
        return this.activeConversations.get(conversationId);
    }

    /**
     * End conversation
     */
    endConversation(conversationId: string): void {
        this.activeConversations.delete(conversationId);
    }

    /**
     * Get active conversation count
     */
    getActiveConversationCount(): number {
        return this.activeConversations.size;
    }
}
