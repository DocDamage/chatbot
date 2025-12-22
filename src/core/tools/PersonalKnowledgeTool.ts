
import { Tool, ToolCategory, ToolResult } from '../../types/tools';
import { KnowledgeSources } from '../knowledge';
import { SongwritingStyleSource } from '../knowledge/SongwritingStyleSource';
import { PersonalResearchSource } from '../knowledge/PersonalResearchSource';
import { logger } from '../observability/logger';

export class PersonalKnowledgeTool implements Tool {
    id = 'manage_personal_knowledge';
    // Must be unique across all tools
    name = 'managePersonalKnowledge';
    description = 'Manage personal knowledge base. Add songs, research topics, or code snippets to persistent storage. Search functionality is separate.';
    category = ToolCategory.KNOWLEDGE;

    parameters = [
        {
            name: 'action',
            type: 'string' as const,
            description: 'Action to perform: "add_song", "add_research", "add_snippet"',
            required: true
        },
        {
            name: 'title',
            type: 'string' as const,
            description: 'Title of the entry',
            required: true
        },
        {
            name: 'content',
            type: 'string' as const,
            description: 'Main content (lyrics context, research text, or description for snippet)',
            required: true
        },
        {
            name: 'metadata',
            type: 'object' as const,
            description: 'Additional data depending on action. For lyrics: {genre, mood}. For research: {category}. For snippet: {code, language, tags}.',
            required: false
        }
    ];

    async execute(params: Record<string, any>): Promise<ToolResult> {
        const startTime = Date.now();
        const { action, title, content, metadata = {} } = params;

        try {
            if (action === 'add_song') {
                const source = KnowledgeSources.songwriting_style() as SongwritingStyleSource;
                await source.addSong(title, content, metadata);

                return {
                    success: true,
                    data: `Successfully added song: "${title}"`,
                    metadata: { executionTime: Date.now() - startTime }
                };
            }

            if (action === 'add_research') {
                const source = KnowledgeSources.personal_research() as PersonalResearchSource;
                const category = metadata.category || 'General';
                await source.addResearchTopic(title, content, category);

                return {
                    success: true,
                    data: `Successfully added research topic: "${title}" (Category: ${category})`,
                    metadata: { executionTime: Date.now() - startTime }
                };
            }

            if (action === 'add_snippet') {
                const source = KnowledgeSources.personal_research() as PersonalResearchSource;
                const code = metadata.code || '';
                const language = metadata.language || 'text';
                const tags = metadata.tags || [];

                if (!code) {
                    throw new Error('Code content is required for "add_snippet" in metadata.code');
                }

                await source.addCodeSnippet(title, code, language, content, tags);

                return {
                    success: true,
                    data: `Successfully added code snippet: "${title}" (${language})`,
                    metadata: { executionTime: Date.now() - startTime }
                };
            }

            return {
                success: false,
                data: `Unknown action: ${action}`,
                metadata: { executionTime: Date.now() - startTime }
            };

        } catch (error: any) {
            logger.error('PersonalKnowledgeTool execution failed', { error: error.message, action });
            return {
                success: false,
                error: `Failed to execute ${action}: ${error.message}`,
                metadata: { executionTime: Date.now() - startTime }
            };
        }
    }
}
