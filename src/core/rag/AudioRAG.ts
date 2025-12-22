/**
 * Audio RAG
 * RAG over audio files with transcription, chunking, and time-aligned retrieval
 */

import { logger } from '../observability/logger';
import { VoiceAgent, TranscriptionResult, WordTiming } from '../voice/VoiceAgent';
import * as fs from 'fs';
import * as path from 'path';

export interface AudioDocument {
    id: string;
    filename: string;
    filepath: string;
    duration: number;
    transcript: string;
    chunks: AudioChunk[];
    metadata: Record<string, any>;
    indexedAt: Date;
}

export interface AudioChunk {
    id: string;
    documentId: string;
    text: string;
    startTime: number;
    endTime: number;
    embedding?: number[];
    words?: WordTiming[];
}

export interface AudioSearchResult {
    chunk: AudioChunk;
    document: AudioDocument;
    score: number;
    context: string;
}

export interface AudioRAGConfig {
    chunkDuration: number; // seconds per chunk
    chunkOverlap: number; // seconds of overlap
    minChunkLength: number; // minimum characters per chunk
    maxResults: number;
}

export class AudioRAG {
    private voiceAgent: VoiceAgent;
    private documents: Map<string, AudioDocument> = new Map();
    private chunks: Map<string, AudioChunk> = new Map();
    private chunkEmbeddings: Map<string, number[]> = new Map();
    private config: AudioRAGConfig;
    private embeddingService: any; // EmbeddingService interface

    constructor(
        voiceAgent: VoiceAgent,
        embeddingService: any,
        config?: Partial<AudioRAGConfig>
    ) {
        this.voiceAgent = voiceAgent;
        this.embeddingService = embeddingService;
        this.config = {
            chunkDuration: 30, // 30 seconds per chunk
            chunkOverlap: 5, // 5 seconds overlap
            minChunkLength: 50,
            maxResults: 5,
            ...config
        };
    }

    /**
     * Index an audio file
     */
    async indexAudio(
        filepath: string,
        metadata: Record<string, any> = {}
    ): Promise<AudioDocument> {
        logger.info('Indexing audio file', { filepath });

        // Read audio file
        const audioBuffer = fs.readFileSync(filepath);

        // Transcribe entire file with word timings
        const transcription = await this.voiceAgent.transcribe(audioBuffer);

        const documentId = this.generateId();

        // Create chunks based on time
        const chunks = this.createTimeChunks(
            documentId,
            transcription.text,
            transcription.words || [],
            transcription.duration
        );

        // Generate embeddings for chunks
        await this.generateChunkEmbeddings(chunks);

        const document: AudioDocument = {
            id: documentId,
            filename: path.basename(filepath),
            filepath,
            duration: transcription.duration,
            transcript: transcription.text,
            chunks,
            metadata,
            indexedAt: new Date()
        };

        this.documents.set(documentId, document);

        for (const chunk of chunks) {
            this.chunks.set(chunk.id, chunk);
        }

        logger.info('Audio indexed', {
            documentId,
            duration: transcription.duration,
            chunks: chunks.length
        });

        return document;
    }

    /**
     * Search across indexed audio
     */
    async search(query: string, limit?: number): Promise<AudioSearchResult[]> {
        const maxResults = limit || this.config.maxResults;

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.embed(query);

        // Search all chunks
        const results: AudioSearchResult[] = [];

        for (const [chunkId, chunk] of this.chunks) {
            const embedding = this.chunkEmbeddings.get(chunkId);
            if (!embedding) continue;

            const score = this.cosineSimilarity(queryEmbedding, embedding);
            const document = this.documents.get(chunk.documentId);

            if (!document) continue;

            results.push({
                chunk,
                document,
                score,
                context: this.getChunkContext(chunk, document)
            });
        }

        // Sort by score and return top results
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, maxResults);
    }

    /**
     * Query with natural language and get answer with citations
     */
    async query(
        question: string,
        llmHandler: (prompt: string) => Promise<string>
    ): Promise<{ answer: string; sources: AudioSearchResult[] }> {
        // Search for relevant chunks
        const results = await this.search(question, 5);

        if (results.length === 0) {
            return {
                answer: 'No relevant audio content found.',
                sources: []
            };
        }

        // Build context from audio chunks
        const context = results
            .map((r, i) => {
                const timeRange = `[${this.formatTime(r.chunk.startTime)} - ${this.formatTime(r.chunk.endTime)}]`;
                return `[Source ${i + 1}] From "${r.document.filename}" ${timeRange}:\n${r.chunk.text}`;
            })
            .join('\n\n');

        // Generate answer
        const prompt = `Based on the following audio transcripts, answer the question.

Question: ${question}

Audio Transcripts:
${context}

Provide a comprehensive answer citing the sources by number [Source X].`;

        const answer = await llmHandler(prompt);

        return { answer, sources: results };
    }

    /**
     * Get audio clip for a chunk
     */
    async getAudioClip(chunkId: string): Promise<Buffer | null> {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) return null;

        const document = this.documents.get(chunk.documentId);
        if (!document || !fs.existsSync(document.filepath)) return null;

        // In production, use ffmpeg to extract clip
        // For now, return placeholder
        logger.info('Would extract audio clip', {
            file: document.filename,
            start: chunk.startTime,
            end: chunk.endTime
        });

        return null;
    }

    /**
     * List all indexed documents
     */
    listDocuments(): AudioDocument[] {
        return Array.from(this.documents.values());
    }

    /**
     * Get document by ID
     */
    getDocument(documentId: string): AudioDocument | undefined {
        return this.documents.get(documentId);
    }

    /**
     * Remove document
     */
    removeDocument(documentId: string): boolean {
        const document = this.documents.get(documentId);
        if (!document) return false;

        // Remove chunks
        for (const chunk of document.chunks) {
            this.chunks.delete(chunk.id);
            this.chunkEmbeddings.delete(chunk.id);
        }

        this.documents.delete(documentId);
        return true;
    }

    /**
     * Create time-based chunks from transcript
     */
    private createTimeChunks(
        documentId: string,
        transcript: string,
        words: WordTiming[],
        duration: number
    ): AudioChunk[] {
        const chunks: AudioChunk[] = [];

        if (words.length === 0) {
            // No word timings - split by estimated time
            const charsPerSecond = transcript.length / duration;
            const charsPerChunk = charsPerSecond * this.config.chunkDuration;

            let position = 0;
            let chunkIndex = 0;

            while (position < transcript.length) {
                const end = Math.min(position + charsPerChunk, transcript.length);
                const text = transcript.substring(position, end);

                if (text.trim().length >= this.config.minChunkLength) {
                    const startTime = (position / transcript.length) * duration;
                    const endTime = (end / transcript.length) * duration;

                    chunks.push({
                        id: `${documentId}_chunk_${chunkIndex}`,
                        documentId,
                        text: text.trim(),
                        startTime,
                        endTime
                    });
                    chunkIndex++;
                }

                position = end - (charsPerSecond * this.config.chunkOverlap);
                if (position === end) break; // Prevent infinite loop
            }
        } else {
            // Use word timings for precise chunking
            let chunkIndex = 0;
            let currentChunk: WordTiming[] = [];
            let chunkStart = 0;

            for (const word of words) {
                if (currentChunk.length === 0) {
                    chunkStart = word.start;
                }

                currentChunk.push(word);
                const chunkDuration = word.end - chunkStart;

                if (chunkDuration >= this.config.chunkDuration) {
                    const text = currentChunk.map(w => w.word).join(' ');

                    if (text.length >= this.config.minChunkLength) {
                        chunks.push({
                            id: `${documentId}_chunk_${chunkIndex}`,
                            documentId,
                            text,
                            startTime: chunkStart,
                            endTime: word.end,
                            words: [...currentChunk]
                        });
                        chunkIndex++;
                    }

                    // Keep overlap words
                    const overlapStart = word.end - this.config.chunkOverlap;
                    currentChunk = currentChunk.filter(w => w.start >= overlapStart);
                    chunkStart = currentChunk[0]?.start || word.end;
                }
            }

            // Add remaining words as final chunk
            if (currentChunk.length > 0) {
                const text = currentChunk.map(w => w.word).join(' ');
                if (text.length >= this.config.minChunkLength) {
                    chunks.push({
                        id: `${documentId}_chunk_${chunkIndex}`,
                        documentId,
                        text,
                        startTime: chunkStart,
                        endTime: currentChunk[currentChunk.length - 1].end,
                        words: currentChunk
                    });
                }
            }
        }

        return chunks;
    }

    /**
     * Generate embeddings for chunks
     */
    private async generateChunkEmbeddings(chunks: AudioChunk[]): Promise<void> {
        for (const chunk of chunks) {
            try {
                const embedding = await this.embeddingService.embed(chunk.text);
                chunk.embedding = embedding;
                this.chunkEmbeddings.set(chunk.id, embedding);
            } catch (error) {
                logger.warn('Failed to generate embedding for chunk', {
                    chunkId: chunk.id
                });
            }
        }
    }

    /**
     * Get surrounding context for a chunk
     */
    private getChunkContext(chunk: AudioChunk, document: AudioDocument): string {
        const chunkIndex = document.chunks.findIndex(c => c.id === chunk.id);

        const contextChunks: string[] = [];

        // Add previous chunk if exists
        if (chunkIndex > 0) {
            contextChunks.push(`[Before] ${document.chunks[chunkIndex - 1].text.substring(0, 100)}...`);
        }

        // Add current chunk
        contextChunks.push(`[Current] ${chunk.text}`);

        // Add next chunk if exists
        if (chunkIndex < document.chunks.length - 1) {
            contextChunks.push(`[After] ...${document.chunks[chunkIndex + 1].text.substring(0, 100)}`);
        }

        return contextChunks.join('\n');
    }

    /**
     * Format time in mm:ss format
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

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
