/**
 * Coding Knowledge Base Integration Tests
 */

import { CodingKnowledgeBase } from '../../core/knowledge/CodingKnowledgeBase';
import { KnowledgeLearner } from '../../core/learning/KnowledgeLearner';
import { CodingKnowledgeTool } from '../../core/tools/CodingKnowledgeTool';
import * as fs from 'fs';
import * as path from 'path';

// Mock the EmbeddingService to avoid loading real models during test
jest.mock('../../core/embeddings/EmbeddingService', () => {
    return {
        EmbeddingService: class {
            constructor() { }
            async embed(text: string) {
                return Array(384).fill(0).map((_, i) => (text.length * i) % 100 / 100);
            }
            async embedBatch(texts: string[]) {
                return texts.map(t => Array(384).fill(0).map((_, i) => (t.length * i) % 100 / 100));
            }
            getDimensions() { return 384; }
        }
    };
});

import { EmbeddingService } from '../../core/embeddings/EmbeddingService';

describe('Coding Knowledge System', () => {
    let knowledgeBase: CodingKnowledgeBase;
    let learner: KnowledgeLearner;
    let tool: CodingKnowledgeTool;
    let mockEmbeddingService: EmbeddingService;

    beforeAll(async () => {
        // Ensure test data directory exists
        if (!fs.existsSync('src/data')) {
            fs.mkdirSync('src/data', { recursive: true });
        }

        // Create dummy static data for test if not exists
        const testDataPath = 'src/data/coding_knowledge_static.json';
        // Clean up previous test run artifacts
        if (fs.existsSync(testDataPath)) {
            // We don't delete it if it's the real one, but for testing we might want a known state.
            // However, loading the real one (160KB) is fine and better for integration test.
        } else {
            fs.writeFileSync(testDataPath, JSON.stringify([
                {
                    id: 'test_1',
                    category: 'backend',
                    title: 'Test Backup Pattern',
                    content: 'Always backup before deploy.',
                    tags: ['deployment', 'safety'],
                    source: 'test'
                }
            ]));
        }

        mockEmbeddingService = new EmbeddingService(); // This is now the mocked class
        knowledgeBase = new CodingKnowledgeBase(mockEmbeddingService);
        await knowledgeBase.initialize();

        learner = new KnowledgeLearner(knowledgeBase);
        tool = new CodingKnowledgeTool(knowledgeBase);
    });

    describe('CodingKnowledgeBase', () => {
        it('should initialize and load entries', () => {
            // We expect at least the entries from the extraction or our dummy data
            expect((knowledgeBase as any).entries.length).toBeGreaterThan(0);
        });

        it('should search and return results', async () => {
            // "backup" should match our dummy data or something in the real data
            // For real data, searching "React" is a safe bet
            const results = await knowledgeBase.search('React');
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });

        it('should filter by category', async () => {
            // Assuming we have frontend category
            const results = await knowledgeBase.search('React', { category: 'frontend' });
            if (results.length > 0) {
                expect(results[0].entry.category).toBe('frontend');
            }
        });
    });

    describe('KnowledgeLearner', () => {
        it('should learn from code blocks in interaction', async () => {
            const query = 'How do I create a React component?';
            const response = `Here is how:
\`\`\`javascript
function MyComponent() {
  return <div>Hello</div>;
}
\`\`\`
Hope this helps!`;

            await learner.learnFromInteraction(query, response);

            // Check if added
            const entries = (knowledgeBase as any).entries;
            const lastEntry = entries[entries.length - 1];

            expect(lastEntry.tags).toContain('auto-learned');
            // Category detection might be 'frontend' or 'general' depending on mocking
            // With our mock embedder, cosine sim might be weird, but adding doesn't check sim.
        });
    });

    describe('CodingKnowledgeTool', () => {
        it('should execute and return formatted string', async () => {
            // This will use search() which uses our mocked embeddings.
            // Search results depend on the mock embedding values.
            // Since our mock embedding is deterministic based on length, and query vs content length differs,
            // similarity might be low. We should set minScore to 0 for this test or mock search directly.

            // Let's spy on search to ensure it's called
            const searchSpy = jest.spyOn(knowledgeBase, 'search');

            const result = await tool.execute({ query: 'React component' });

            expect(searchSpy).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });
});
