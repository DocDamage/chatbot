
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

interface ResearchEntry {
    id: string;
    title: string;
    content: string;
    metadata: {
        type: 'research_topic' | 'code_snippet';
        category?: string;
        language?: string;
        tags?: string[];
    };
}

export class PersonalResearchSource implements KnowledgeSource {
    public name = 'personal_research';
    private entries: ResearchEntry[] = [];
    private isLoaded = false;
    private styleFilePath = path.join(process.cwd(), 'docs', 'My Writing Style.txt');
    private snippetsFilePath = path.join(process.cwd(), 'docs', 'all_extracted_snippets.json');

    constructor() { }

    async addResearchTopic(title: string, content: string, category: string): Promise<void> {
        const entry = `
\n\n
========================================
${title}
(Category: ${category})
========================================
${content}
`;
        try {
            fs.appendFileSync(this.styleFilePath, entry);
            this.isLoaded = false;
        } catch (error) {
            logger.error('Failed to save research topic', error);
            throw error;
        }
    }

    async addCodeSnippet(title: string, code: string, language: string, description: string, tags: string[]): Promise<void> {
        if (!fs.existsSync(this.snippetsFilePath)) return;

        try {
            const fileContent = fs.readFileSync(this.snippetsFilePath, 'utf-8');
            const snippets = JSON.parse(fileContent);

            snippets.push({
                title,
                code,
                language,
                description,
                tags,
                source: 'User Added'
            });

            fs.writeFileSync(this.snippetsFilePath, JSON.stringify(snippets, null, 2));
            this.isLoaded = false;
        } catch (error) {
            logger.error('Failed to save code snippet', error);
            throw error;
        }
    }


    async isAvailable(): Promise<boolean> {
        return fs.existsSync(this.styleFilePath) && fs.existsSync(this.snippetsFilePath);
    }

    private async loadData(): Promise<void> {
        if (this.isLoaded) return;

        try {
            await Promise.all([
                this.loadResearchTopics(),
                this.loadCodeSnippets()
            ]);
            this.isLoaded = true;
        } catch (error) {
            logger.error('Error loading personal research data:', error);
        }
    }

    private async loadResearchTopics() {
        if (!fs.existsSync(this.styleFilePath)) return;

        const content = fs.readFileSync(this.styleFilePath, 'utf-8');
        const normalized = content.replace(/\r\n/g, '\n');

        // Define known topics to look for as anchors
        const topics = [
            { key: 'ADHD', category: 'Neurodivergence' },
            { key: 'Attention Deficit', category: 'Neurodivergence' },
            { key: 'Autism', category: 'Neurodivergence' },
            { key: 'ASD', category: 'Neurodivergence' },
            { key: 'Numerology', category: 'Esoteric' },
            { key: 'Symbology', category: 'Esoteric' },
            { key: 'Hip Hop History', category: 'Music History' },
            { key: 'Timeline', category: 'Music History' },
            { key: 'Producer', category: 'Music Theory' },
            { key: 'Frequency', category: 'Esoteric' }
        ];

        // Split by 2+ newlines to find paragraphs/sections
        const chunks = normalized.split(/\n\s*\n/);

        let idCounter = 1;
        for (const chunk of chunks) {
            const trimmed = chunk.trim();
            if (trimmed.length < 50) continue;

            // Skip songs (lyrics markers)
            const lower = trimmed.toLowerCase();
            if (lower.includes('[verse') || lower.includes('[chorus]') || lower.includes('[intro]') || lower.includes('[hook]')) continue;
            if (trimmed.includes('songs/lyrics') || trimmed.includes('======')) continue;

            // Classify
            let category = 'General';
            // Use first line as title, clean up md headers
            let title = trimmed.split('\n')[0].replace(/^#+\s*/, '').trim().substring(0, 100);

            const matchedTopic = topics.find(t => trimmed.includes(t.key) || title.includes(t.key));

            if (matchedTopic) {
                category = matchedTopic.category;
            } else {
                // If it doesn't match a known topic, heuristic check:
                // Does it look like factual text? (contains bullets, colons, dates)
                // If it's just random commentary, maybe skip or categorize as 'General'
                // We'll keep it as General to be safe, unless it looks like just a name.
                if (trimmed.length < 100) continue;
            }

            this.entries.push({
                id: `research_${idCounter++}`,
                title: title || 'Untitled Research',
                content: trimmed,
                metadata: {
                    type: 'research_topic',
                    category,
                    tags: [category]
                }
            });
        }
    }

    private async loadCodeSnippets() {
        if (!fs.existsSync(this.snippetsFilePath)) return;

        try {
            const fileContent = fs.readFileSync(this.snippetsFilePath, 'utf-8');
            const snippets = JSON.parse(fileContent);

            let idCounter = 1;
            for (const snippet of snippets) {
                const content = `${snippet.description || ''}\n\n\`\`\`${snippet.language || ''}\n${snippet.code || ''}\n\`\`\``;

                this.entries.push({
                    id: `snippet_${idCounter++}`,
                    title: snippet.title || `Snippet ${idCounter}`,
                    content: content,
                    metadata: {
                        type: 'code_snippet',
                        language: snippet.language || 'text',
                        tags: snippet.tags || [],
                        category: 'Coding'
                    }
                });
            }
        } catch (e) {
            logger.error('Failed to parse snippets JSON', e);
        }
    }

    async search(query: string, options?: any): Promise<KnowledgeResult[]> {
        await this.loadData();
        const lowerQuery = query.toLowerCase();

        const results = this.entries.filter(entry => {
            return entry.title.toLowerCase().includes(lowerQuery) ||
                entry.content.toLowerCase().includes(lowerQuery) ||
                (entry.metadata.tags && entry.metadata.tags.some(t => t.toLowerCase().includes(lowerQuery)));
        });

        return results.slice(0, 20).map(entry => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            source: entry.metadata.type === 'code_snippet' ? 'GitHub Snippets' : 'Personal Research',
            url: entry.metadata.type === 'code_snippet' ? this.snippetsFilePath : this.styleFilePath,
            metadata: entry.metadata,
            confidence: 1.0
        }));
    }

    async getById(id: string): Promise<KnowledgeResult | null> {
        await this.loadData();
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return null;

        return {
            id: entry.id,
            title: entry.title,
            content: entry.content,
            source: entry.metadata.type === 'code_snippet' ? 'GitHub Snippets' : 'Personal Research',
            url: entry.metadata.type === 'code_snippet' ? this.snippetsFilePath : this.styleFilePath,
            metadata: entry.metadata,
            confidence: 1.0
        };
    }
}
