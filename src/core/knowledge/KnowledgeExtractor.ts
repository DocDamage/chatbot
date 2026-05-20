/**
 * Knowledge Extractor
 * Extracts structured coding knowledge from PDF and Markdown documentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../observability/logger';

export interface StaticKnowledgeEntry {
    id: string;
    category: string;
    title: string;
    content: string;
    tags: string[];
    source: string;
    metadata?: {
        language?: string;
        framework?: string;
        project?: string;
        sourceType?: 'repo-doc' | 'code' | 'test' | 'past-fix' | 'external';
        authority?: 'canonical' | 'learned' | 'external';
    };
}

export class KnowledgeExtractor {
    private pdfPath: string;
    private mdPath: string;
    private outputPath: string;

    constructor(
        pdfPath: string = 'docs/Code_Encyclopedia_Master.pdf',
        mdPath: string = 'docs/geminigeminstructions.md',
        outputPath: string = 'src/data/coding_knowledge_static.json'
    ) {
        this.pdfPath = path.resolve(process.cwd(), pdfPath);
        this.mdPath = path.resolve(process.cwd(), mdPath);
        this.outputPath = path.resolve(process.cwd(), outputPath);
    }

    /**
     * Run the full extraction process
     */
    async extractAll(): Promise<StaticKnowledgeEntry[]> {
        const entries: StaticKnowledgeEntry[] = [];

        try {
            // Extract from Markdown
            if (fs.existsSync(this.mdPath)) {
                logger.info('Extracting from Markdown...', { path: this.mdPath });
                const mdEntries = await this.extractFromMarkdown();
                entries.push(...mdEntries);
            } else {
                logger.warn('Markdown file not found', { path: this.mdPath });
            }

            // Extract from PDF
            if (fs.existsSync(this.pdfPath)) {
                logger.info('Extracting from PDF...', { path: this.pdfPath });
                const pdfEntries = await this.extractFromPdf();
                entries.push(...pdfEntries);
            } else {
                logger.warn('PDF file not found', { path: this.pdfPath });
            }

            // Save to JSON
            this.saveToJson(entries);
            logger.info('Extraction complete', { count: entries.length, output: this.outputPath });

            return entries;
        } catch (error: any) {
            logger.error('Extraction failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Extract knowledge from Markdown files
     * Parses headers to create structured entries
     */
    private async extractFromMarkdown(): Promise<StaticKnowledgeEntry[]> {
        const content = fs.readFileSync(this.mdPath, 'utf-8');
        const lines = content.split('\n');
        const entries: StaticKnowledgeEntry[] = [];

        let currentCategory = 'general';
        let currentTitle = 'Gemini Instructions';
        let currentContent: string[] = [];

        // Simple state machine for parsing
        for (const line of lines) {
            // Detect Categories (e.g. "/frontend — ...")
            if (line.startsWith('/') && line.includes('—')) {
                // Save previous section
                if (currentContent.length > 0) {
                    entries.push(this.createEntry(currentCategory, currentTitle, currentContent.join('\n'), 'gemini_md'));
                    currentContent = [];
                }

                const parts = line.split('—');
                currentCategory = parts[0].replace('/', '').trim();
                currentTitle = parts[1] ? parts[1].trim() : 'Overview';
                continue;
            }

            // Detect Major Headers (e.g. "I. Purpose")
            if (line.match(/^[IVX]+\.\s/)) {
                if (currentContent.length > 0) {
                    entries.push(this.createEntry(currentCategory, currentTitle, currentContent.join('\n'), 'gemini_md'));
                    currentContent = [];
                }
                currentTitle = line.trim();
                continue;
            }

            // Detect subheaders (###)
            if (line.startsWith('### ')) {
                if (currentContent.length > 0) {
                    entries.push(this.createEntry(currentCategory, currentTitle, currentContent.join('\n'), 'gemini_md'));
                    currentContent = [];
                }
                currentTitle = line.replace('### ', '').trim();
                continue;
            }

            currentContent.push(line);
        }

        // Save last section
        if (currentContent.length > 0) {
            entries.push(this.createEntry(currentCategory, currentTitle, currentContent.join('\n'), 'gemini_md'));
        }

        return entries;
    }

    /**
     * Extract knowledge from PDF
     * Uses pdf-parse
     */
    private async extractFromPdf(): Promise<StaticKnowledgeEntry[]> {
        try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(this.pdfPath);
            const data = await pdfParse(dataBuffer);
            const text = data.text;

            // Split by pages or major sections if possible
            // For now, simpler splitting by obvious headers if they exist, 
            // or just chunking if unstructured.

            // Heuristic: Try to split by distinctive separating lines or capitalization patterns
            // If the PDF is the "Code Encyclopedia", it likely has topics.

            // Fallback: Create one massive entry if parsing is too hard, 
            // or split by paragraphs. 
            // Better approach: Split by double newlines and group slightly.

            const entries: StaticKnowledgeEntry[] = [];
            const paragraphs = text.split(/\n\s*\n/);

            let currentChunk: string[] = [];
            let currentTitle = 'Encyclopedic Code Knowledge';
            let chunkCount = 0;

            for (const para of paragraphs) {
                if (para.trim().length < 5) continue;

                // Naive header detection (short lines, no punctuation at end, maybe all caps)
                const isHeader = para.length < 100 && !para.trim().endsWith('.') && (para === para.toUpperCase() || para.match(/^[0-9]+\./));

                if (isHeader && currentChunk.length > 5) {
                    entries.push({
                        id: `enc_pdf_${chunkCount++}`,
                        category: 'encyclopedia',
                        title: currentTitle,
                        content: currentChunk.join('\n\n'),
                        tags: ['reference', 'pdf'],
                        source: 'Code_Encyclopedia_Master.pdf'
                    });
                    currentChunk = [];
                    currentTitle = para.trim();
                } else {
                    currentChunk.push(para);
                }
            }

            // Add final chunk
            if (currentChunk.length > 0) {
                entries.push({
                    id: `enc_pdf_${chunkCount}`,
                    category: 'encyclopedia',
                    title: currentTitle,
                    content: currentChunk.join('\n\n'),
                    tags: ['reference', 'pdf'],
                    source: 'Code_Encyclopedia_Master.pdf'
                });
            }

            return entries;

        } catch (error: any) {
            logger.error('PDF parsing failed', { error: error.message });
            return [];
        }
    }

    private createEntry(category: string, title: string, content: string, source: string): StaticKnowledgeEntry {
        // Generate simple tags
        const tags = [category, source];
        if (content.includes('function')) tags.push('code');
        if (content.includes('import ')) tags.push('import');

        return {
            id: `${source}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            category: category.toLowerCase(),
            title,
            content: content.trim(),
            tags,
            source
        };
    }

    private saveToJson(entries: StaticKnowledgeEntry[]) {
        fs.writeFileSync(this.outputPath, JSON.stringify(entries, null, 2));
    }
}

// Allow direct execution if run as script
if (require.main === module) {
    const extractor = new KnowledgeExtractor();
    extractor.extractAll().catch(console.error);
}
