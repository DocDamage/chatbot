/**
 * Coding Knowledge Tool
 * Exposes the coding knowledge base to the agent
 */

import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import { CodingKnowledgeBase } from '../knowledge/CodingKnowledgeBase';
import { logger } from '../observability/logger';

export class CodingKnowledgeTool implements Tool {
    id = 'get_coding_knowledge';
    name = 'getCodingKnowledge';
    description = 'Exhaustive coding knowledge base. Use this to search for best practices, design patterns, security guidelines, and code snippets before writing any code. Supports: frontend (React/Next.js), backend (Python/FastAPI/Django), database design, and deployment.';
    category = ToolCategory.KNOWLEDGE;

    private knowledgeBase: CodingKnowledgeBase;

    parameters = [
        {
            name: 'query',
            type: 'string' as const,
            description: 'Search query (e.g. "FastAPI authentication patterns", "React performance optimization", "secure API design")',
            required: true
        },
        {
            name: 'category',
            type: 'string' as const,
            description: 'Optional filter: frontend, backend, database, deployment, security, ai',
            required: false
        },
        {
            name: 'limit',
            type: 'number' as const,
            description: 'Number of results to return (default: 3)',
            required: false
        }
    ];

    constructor(knowledgeBase: CodingKnowledgeBase) {
        this.knowledgeBase = knowledgeBase;
    }

    async execute(params: Record<string, any>): Promise<ToolResult> {
        const startTime = Date.now();
        const { query, category, limit } = params;

        try {
            const results = await this.knowledgeBase.search(query, {
                limit: limit || 3,
                category
            });

            if (results.length === 0) {
                return {
                    success: true,
                    data: 'No specific coding knowledge found for this query. Use general coding principles.',
                    metadata: {
                        executionTime: Date.now() - startTime
                    }
                };
            }

            // Format results for the LLM
            const formattedData = results.map((r, index) => {
                return `MATCH #${index + 1} (Score: ${r.score.toFixed(2)}) - [${r.entry.category.toUpperCase()}]\n` +
                    `TITLE: ${r.entry.title}\n` +
                    `----------------------------------------\n` +
                    `${r.entry.content}\n` +
                    `----------------------------------------\n` +
                    `Source: ${r.entry.source}\n`;
            }).join('\n\n');

            return {
                success: true,
                data: formattedData,
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };

        } catch (error: any) {
            logger.error('CodingKnowledgeTool execution failed', { error: error.message });
            return {
                success: false,
                error: `Failed to retrieve coding knowledge: ${error.message}`,
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };
        }
    }
}
