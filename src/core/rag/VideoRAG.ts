/**
 * Video RAG
 * Chat with videos using frame extraction + transcription
 */

import { logger } from '../observability/logger';
import { VoiceAgent } from '../voice/VoiceAgent';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoDocument {
    id: string;
    filename: string;
    filepath: string;
    duration: number;
    transcript: string;
    frames: VideoFrame[];
    chunks: VideoChunk[];
    metadata: Record<string, any>;
    indexedAt: Date;
}

export interface VideoFrame {
    id: string;
    timestamp: number;
    imagePath?: string;
    description?: string;
    embedding?: number[];
}

export interface VideoChunk {
    id: string;
    documentId: string;
    text: string;
    startTime: number;
    endTime: number;
    frames: string[]; // frame IDs
    embedding?: number[];
}

export interface VideoSearchResult {
    chunk: VideoChunk;
    document: VideoDocument;
    score: number;
    frames: VideoFrame[];
}

export interface VideoRAGConfig {
    frameInterval: number; // seconds between keyframes
    chunkDuration: number;
    useVision: boolean; // use vision model for frame analysis
    tempDir: string;
}

export class VideoRAG {
    private voiceAgent: VoiceAgent;
    private embeddingService: any;
    private visionService: any;
    private documents: Map<string, VideoDocument> = new Map();
    private config: VideoRAGConfig;

    constructor(
        voiceAgent: VoiceAgent,
        embeddingService: any,
        visionService?: any,
        config?: Partial<VideoRAGConfig>
    ) {
        this.voiceAgent = voiceAgent;
        this.embeddingService = embeddingService;
        this.visionService = visionService;
        this.config = {
            frameInterval: 10, // Extract frame every 10 seconds
            chunkDuration: 30,
            useVision: !!visionService,
            tempDir: path.join(process.cwd(), 'temp/video'),
            ...config
        };

        // Ensure temp directory exists
        if (!fs.existsSync(this.config.tempDir)) {
            fs.mkdirSync(this.config.tempDir, { recursive: true });
        }
    }

    /**
     * Index a video file
     */
    async indexVideo(
        filepath: string,
        metadata: Record<string, any> = {}
    ): Promise<VideoDocument> {
        logger.info('Indexing video', { filepath });

        const documentId = this.generateId();
        const filename = path.basename(filepath);

        // Extract audio and transcribe
        const audioPath = await this.extractAudio(filepath, documentId);
        const transcript = await this.transcribeAudio(audioPath);

        // Extract keyframes
        const frames = await this.extractFrames(filepath, documentId);

        // Analyze frames with vision if available
        if (this.config.useVision && this.visionService) {
            await this.analyzeFrames(frames);
        }

        // Create chunks combining audio transcript and frame info
        const chunks = this.createVideoChunks(documentId, transcript, frames);

        // Generate embeddings
        await this.generateChunkEmbeddings(chunks);

        const document: VideoDocument = {
            id: documentId,
            filename,
            filepath,
            duration: transcript.duration,
            transcript: transcript.text,
            frames,
            chunks,
            metadata,
            indexedAt: new Date()
        };

        this.documents.set(documentId, document);

        logger.info('Video indexed', {
            documentId,
            duration: transcript.duration,
            frames: frames.length,
            chunks: chunks.length
        });

        return document;
    }

    /**
     * Search across indexed videos
     */
    async search(query: string, limit: number = 5): Promise<VideoSearchResult[]> {
        const queryEmbedding = await this.embeddingService.embed(query);
        const results: VideoSearchResult[] = [];

        for (const document of this.documents.values()) {
            for (const chunk of document.chunks) {
                if (!chunk.embedding) continue;

                const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
                const frames = chunk.frames
                    .map(fId => document.frames.find(f => f.id === fId))
                    .filter((f): f is VideoFrame => !!f);

                results.push({ chunk, document, score, frames });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    /**
     * Query video content with natural language
     */
    async query(
        question: string,
        llmHandler: (prompt: string, images?: string[]) => Promise<string>
    ): Promise<{ answer: string; sources: VideoSearchResult[] }> {
        const results = await this.search(question, 3);

        if (results.length === 0) {
            return { answer: 'No relevant video content found.', sources: [] };
        }

        // Build context
        let context = '';
        const imagePaths: string[] = [];

        for (const [i, result] of results.entries()) {
            const timeRange = `${this.formatTime(result.chunk.startTime)} - ${this.formatTime(result.chunk.endTime)}`;
            context += `[Source ${i + 1}] From "${result.document.filename}" [${timeRange}]:\n`;
            context += `Transcript: ${result.chunk.text}\n`;

            // Add frame descriptions
            for (const frame of result.frames.slice(0, 2)) {
                if (frame.description) {
                    context += `Frame at ${this.formatTime(frame.timestamp)}: ${frame.description}\n`;
                }
                if (frame.imagePath && fs.existsSync(frame.imagePath)) {
                    imagePaths.push(frame.imagePath);
                }
            }
            context += '\n';
        }

        const prompt = `Based on the following video content, answer the question.

Question: ${question}

Video Content:
${context}

Answer citing sources when possible.`;

        const answer = await llmHandler(prompt, imagePaths.length > 0 ? imagePaths : undefined);

        return { answer, sources: results };
    }

    /**
     * Extract audio from video using ffmpeg
     */
    private async extractAudio(videoPath: string, documentId: string): Promise<string> {
        const outputPath = path.join(this.config.tempDir, `${documentId}_audio.wav`);

        try {
            const ffmpeg = await import('fluent-ffmpeg');

            await new Promise<void>((resolve, reject) => {
                ffmpeg.default(videoPath)
                    .output(outputPath)
                    .audioCodec('pcm_s16le')
                    .audioFrequency(16000)
                    .audioChannels(1)
                    .on('end', () => resolve())
                    .on('error', (err: Error) => reject(err))
                    .run();
            });

            return outputPath;
        } catch (error) {
            logger.warn('FFmpeg extraction failed, returning placeholder', { error });
            return videoPath; // Fallback
        }
    }

    /**
     * Transcribe audio
     */
    private async transcribeAudio(audioPath: string): Promise<{ text: string; duration: number }> {
        try {
            const audioBuffer = fs.readFileSync(audioPath);
            const result = await this.voiceAgent.transcribe(audioBuffer);
            return { text: result.text, duration: result.duration };
        } catch (error) {
            logger.warn('Transcription failed', { error });
            return { text: '', duration: 0 };
        }
    }

    /**
     * Extract keyframes from video
     */
    private async extractFrames(videoPath: string, documentId: string): Promise<VideoFrame[]> {
        const frames: VideoFrame[] = [];

        try {
            const ffmpeg = await import('fluent-ffmpeg');

            // Get video duration
            const metadata = await new Promise<any>((resolve, reject) => {
                ffmpeg.default.ffprobe(videoPath, (err: Error, data: any) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            const duration = metadata.format.duration || 0;
            const frameCount = Math.floor(duration / this.config.frameInterval);

            for (let i = 0; i <= frameCount; i++) {
                const timestamp = i * this.config.frameInterval;
                const frameId = `${documentId}_frame_${i}`;
                const imagePath = path.join(this.config.tempDir, `${frameId}.jpg`);

                await new Promise<void>((resolve, reject) => {
                    ffmpeg.default(videoPath)
                        .screenshots({
                            timestamps: [timestamp],
                            filename: `${frameId}.jpg`,
                            folder: this.config.tempDir,
                            size: '640x360'
                        })
                        .on('end', () => resolve())
                        .on('error', (err: Error) => reject(err));
                });

                frames.push({
                    id: frameId,
                    timestamp,
                    imagePath: fs.existsSync(imagePath) ? imagePath : undefined
                });
            }
        } catch (error) {
            logger.warn('Frame extraction failed', { error });
        }

        return frames;
    }

    /**
     * Analyze frames with vision model
     */
    private async analyzeFrames(frames: VideoFrame[]): Promise<void> {
        for (const frame of frames) {
            if (!frame.imagePath || !fs.existsSync(frame.imagePath)) continue;

            try {
                const imageBuffer = fs.readFileSync(frame.imagePath);
                const description = await this.visionService.describe(imageBuffer);
                frame.description = description;

                const embedding = await this.embeddingService.embed(description);
                frame.embedding = embedding;
            } catch (error) {
                logger.debug('Frame analysis failed', { frameId: frame.id });
            }
        }
    }

    /**
     * Create video chunks combining transcript and frames
     */
    private createVideoChunks(
        documentId: string,
        transcript: { text: string; duration: number },
        frames: VideoFrame[]
    ): VideoChunk[] {
        const chunks: VideoChunk[] = [];
        const charsPerSecond = transcript.text.length / Math.max(transcript.duration, 1);

        let chunkIndex = 0;
        let startTime = 0;

        while (startTime < transcript.duration) {
            const endTime = Math.min(startTime + this.config.chunkDuration, transcript.duration);

            // Extract text for this time range
            const startChar = Math.floor(startTime * charsPerSecond);
            const endChar = Math.floor(endTime * charsPerSecond);
            const text = transcript.text.substring(startChar, endChar);

            // Find frames in this time range
            const chunkFrames = frames
                .filter(f => f.timestamp >= startTime && f.timestamp < endTime)
                .map(f => f.id);

            if (text.trim().length > 0 || chunkFrames.length > 0) {
                chunks.push({
                    id: `${documentId}_chunk_${chunkIndex}`,
                    documentId,
                    text: text.trim(),
                    startTime,
                    endTime,
                    frames: chunkFrames
                });
                chunkIndex++;
            }

            startTime = endTime;
        }

        return chunks;
    }

    /**
     * Generate embeddings for chunks
     */
    private async generateChunkEmbeddings(chunks: VideoChunk[]): Promise<void> {
        for (const chunk of chunks) {
            try {
                const embedding = await this.embeddingService.embed(chunk.text);
                chunk.embedding = embedding;
            } catch (error) {
                logger.debug('Embedding generation failed', { chunkId: chunk.id });
            }
        }
    }

    /**
     * Get document by ID
     */
    getDocument(documentId: string): VideoDocument | undefined {
        return this.documents.get(documentId);
    }

    /**
     * List all documents
     */
    listDocuments(): VideoDocument[] {
        return Array.from(this.documents.values());
    }

    /**
     * Remove document and cleanup files
     */
    removeDocument(documentId: string): boolean {
        const document = this.documents.get(documentId);
        if (!document) return false;

        // Cleanup frame files
        for (const frame of document.frames) {
            if (frame.imagePath && fs.existsSync(frame.imagePath)) {
                fs.unlinkSync(frame.imagePath);
            }
        }

        this.documents.delete(documentId);
        return true;
    }

    /**
     * Format time as mm:ss
     */
    private formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Calculate cosine similarity
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
