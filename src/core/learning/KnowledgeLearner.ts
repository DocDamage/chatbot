/**
 * Knowledge Learner
 * Auto-learns coding patterns from interactions
 */

import { CodingKnowledgeBase } from '../knowledge/CodingKnowledgeBase';
import { logger } from '../observability/logger';

export class KnowledgeLearner {
    private knowledgeBase: CodingKnowledgeBase;

    constructor(knowledgeBase: CodingKnowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    /**
     * Learn from a user interaction
     * Extracts code blocks and explanations from the AI response
     */
    async learnFromInteraction(userQuery: string, systemResponse: string): Promise<void> {
        try {
            // 1. Detect code blocks
            const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
            let match;
            const snippets = [];

            while ((match = codeBlockRegex.exec(systemResponse)) !== null) {
                snippets.push({
                    language: match[1] || 'text',
                    code: match[2].trim()
                });
            }

            if (snippets.length === 0) return;

            // 2. Determine relevance
            // Only learn if the query implies "how to", "example", "pattern", "fix"
            const learnTriggerWords = ['how', 'create', 'pattern', 'example', 'implement', 'fix', 'optimize', 'secure'];
            const shouldLearn = learnTriggerWords.some(w => userQuery.toLowerCase().includes(w));

            if (!shouldLearn && !userQuery.toLowerCase().includes('save')) {
                return;
            }

            // 3. Add to knowledge base
            for (const snippet of snippets) {
                // Skip very short snippets (likely shell commands or simple variables)
                if (snippet.code.length < 50) continue;

                // Generate title from query
                // E.g. "How to implement auth" -> "Auth Implementation Pattern"
                const title = this.generateTitle(userQuery);

                // Detect category
                const category = this.detectCategory(snippet.language, snippet.code);

                await this.knowledgeBase.addSnippet(
                    title,
                    `\n\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\nContext: ${userQuery}`,
                    category,
                    ['auto-learned', snippet.language]
                );

                logger.info('Auto-learned new knowledge', { title, category });
            }

        } catch (error: any) {
            logger.error('Knowledge learning failed', { error: error.message });
        }
    }

    /**
     * Explicitly learn a piece of code
     */
    async learnSnippet(title: string, code: string, category: string = 'general'): Promise<void> {
        await this.knowledgeBase.addSnippet(title, code, category, ['manual-entry']);
    }

    private generateTitle(query: string): string {
        // Simple heuristic: Take the first 5-8 words, title case
        const words = query.replace(/[^\w\s]/g, '').split(' ').slice(0, 8);
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' (Auto-Captured)';
    }

    private detectCategory(language: string, code: string): string {
        if (['javascript', 'typescript', 'tsx', 'jsx'].includes(language)) {
            if (code.includes('useEffect') || code.includes('useState')) return 'frontend';
            if (code.includes('express') || code.includes('NestFactory')) return 'backend';
        }
        if (['python', 'py'].includes(language)) {
            if (code.includes('django')) return 'backend';
            if (code.includes('fastapi')) return 'backend';
            if (code.includes('sklearn') || code.includes('torch')) return 'ai';
        }
        if (['sql', 'prisma'].includes(language)) return 'database';
        if (['docker', 'yaml', 'yml'].includes(language)) return 'deployment';

        return 'general';
    }
}
