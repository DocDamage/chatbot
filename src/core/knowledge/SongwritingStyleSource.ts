
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

interface SongEntry {
    id: string;
    title: string;
    content: string;
    metadata: {
        genre: string;
        mood: string[];
        themes: string[];
        lyricalDevices: string[];
        yearWritten: string;
        version?: string;
    };
}

export class SongwritingStyleSource implements KnowledgeSource {
    public name = 'songwriting_style';
    private songs: SongEntry[] = [];
    private isLoaded = false;
    private filePath = path.join(process.cwd(), 'docs', 'My Writing Style.txt');

    constructor() { }

    async addSong(title: string, content: string, metadata: { genre?: string, mood?: string[], themes?: string[] }): Promise<void> {
        const timestamp = new Date().getFullYear();
        const newSongEntry = `
\n\n
========================================
${title}
(Added: ${timestamp})
========================================
${content}
`;
        // Append to file
        try {
            fs.appendFileSync(this.filePath, newSongEntry);
            // Invalidate cache
            this.isLoaded = false;
        } catch (error) {
            logger.error('Failed to save new song', error);
            throw error;
        }
    }

    async isAvailable(): Promise<boolean> {
        return fs.existsSync(this.filePath);
    }

    private async loadSongs(): Promise<void> {
        if (this.isLoaded) return;

        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf-8');
            // Process the ENTIRE file, as songs are interspersed with research
            this.songs = this.parseSongSection(fileContent);
            this.isLoaded = true;
        } catch (error) {
            logger.error('Error loading songwriting style:', error);
            this.songs = [];
        }
    }

    private parseSongSection(text: string): SongEntry[] {
        const entries: SongEntry[] = [];
        const normalized = text.replace(/\r\n/g, '\n');

        // Split by 2+ newlines to find potential blocks
        const chunks = normalized.split(/\n\s*\n/);

        let idCounter = 1;

        for (const chunk of chunks) {
            const trimmed = chunk.trim();
            // Skip short/irrelevant chunks
            if (trimmed.length < 50) continue;
            if (trimmed.includes('songs/lyrics') || trimmed.includes('research info') || trimmed.includes('====')) continue;

            const lower = trimmed.toLowerCase();

            // Check if it looks like a song
            const hasSongMarkers =
                lower.includes('[intro]') ||
                lower.includes('[verse') ||
                lower.includes('[chorus]') ||
                lower.includes('[hook]') ||
                lower.includes('[outro]') ||
                lower.includes('[spoken word');

            if (!hasSongMarkers) continue; // Skip research/prose

            // Song Found
            const lines = trimmed.split('\n');
            let title = 'Untitled Song';
            let version = 'Raw';

            const firstLine = lines[0].trim();
            // If first line is not a tag and reasonably short, it's a title
            if (!firstLine.startsWith('[') && firstLine.length < 100) {
                title = firstLine.replace(/^#+\s*/, '').trim(); // Remove markdown headers
            }

            if (title.toLowerCase().includes('producer in the dark')) title = 'Producer in the Dark';
            if (trimmed.toLowerCase().includes('martian gang') && title === 'Untitled Song') title = 'Martian Gang';

            const metadata = this.inferMetadata(trimmed);

            entries.push({
                id: `song_${idCounter++}`,
                title,
                content: trimmed,
                metadata: {
                    ...metadata,
                    yearWritten: '2023-2024',
                    version
                }
            });
        }

        return entries;
    }

    private inferMetadata(content: string) {
        const mood: string[] = [];
        const themes: string[] = [];
        const devices: string[] = [];
        const lower = content.toLowerCase();

        // Moods
        if (lower.includes('dark') || lower.includes('pain') || lower.includes('blood')) mood.push('Dark', 'Aggressive');
        if (lower.includes('mind') || lower.includes('soul') || lower.includes('dream')) mood.push('Introspective');
        if (lower.includes('funny') || lower.includes('joke')) mood.push('Humorous');
        if (lower.includes('alien') || lower.includes('martian')) mood.push('Sci-Fi', 'Eerie');

        // Themes
        if (lower.includes('conspiracy') || lower.includes('government') || lower.includes('fluoride')) themes.push('Conspiracy', 'Social Commentary');
        if (lower.includes('struggle') || lower.includes('broke') || lower.includes('pain')) themes.push('Struggle', 'Resilience');
        if (lower.includes('neurodivergent') || lower.includes('adhd') || lower.includes('autism')) themes.push('Neurodivergence');
        if (lower.includes('love') || lower.includes('heart')) themes.push('Relationships');

        // Devices
        if (lower.includes('[spoken word')) devices.push('Spoken Word Intro/Outro');
        if (lower.includes('hook') || lower.includes('chorus')) devices.push('Structured Chorus');
        // Simple rhyme density check is hard, but we can tag based on keywords
        if (lower.includes('metaphor') || lower.includes('like a')) devices.push('Simile/Metaphor');

        return {
            genre: 'Hip Hop / Spoken Word', // Default style
            mood: Array.from(new Set(mood)),
            themes: Array.from(new Set(themes)),
            devices: Array.from(new Set(devices))
        };
    }

    async search(query: string, options?: any): Promise<KnowledgeResult[]> {
        await this.loadSongs();
        const lowerQuery = query.toLowerCase();

        return this.songs.filter(song => {
            return song.title.toLowerCase().includes(lowerQuery) ||
                song.content.toLowerCase().includes(lowerQuery) ||
                song.metadata.themes.some(t => t.toLowerCase().includes(lowerQuery));
        }).map(song => ({
            id: song.id,
            title: song.title,
            content: song.content,
            source: 'My Writing Style - Lyrics',
            url: this.filePath,
            metadata: {
                type: 'song',
                ...song.metadata
            },
            confidence: 1.0
        }));
    }

    async getById(id: string): Promise<KnowledgeResult | null> {
        await this.loadSongs();
        const song = this.songs.find(s => s.id === id);
        if (!song) return null;

        return {
            id: song.id,
            title: song.title,
            content: song.content,
            source: 'My Writing Style - Lyrics',
            url: this.filePath,
            metadata: {
                type: 'song',
                ...song.metadata
            },
            confidence: 1.0
        };
    }
}
