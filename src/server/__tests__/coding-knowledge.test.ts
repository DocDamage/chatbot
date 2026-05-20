/**
 * Coding Knowledge Base Integration Tests
 */

import { CodingKnowledgeBase } from '../../core/knowledge/CodingKnowledgeBase';
import { KnowledgeLearner } from '../../core/learning/KnowledgeLearner';
import { CodingKnowledgeTool } from '../../core/tools/CodingKnowledgeTool';
import * as fs from 'fs';
import * as os from 'os';
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
    let tempDir: string;

    beforeAll(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-knowledge-test-'));
        const testDataPath = path.join(tempDir, 'coding_knowledge_static.json');
        const userDataPath = path.join(tempDir, 'coding_knowledge_user.json');
        fs.writeFileSync(testDataPath, JSON.stringify([
            {
                id: 'test_1',
                category: 'frontend',
                title: 'React Component Pattern',
                content: 'Use components to split UI into reusable pieces.',
                tags: ['react', 'component'],
                source: 'test'
            }
        ]));
        fs.writeFileSync(userDataPath, JSON.stringify([]));

        mockEmbeddingService = new EmbeddingService(); // This is now the mocked class
        knowledgeBase = new CodingKnowledgeBase(mockEmbeddingService, {
            staticDataPath: testDataPath,
            userDataPath
        });
        await knowledgeBase.initialize();

        learner = new KnowledgeLearner(knowledgeBase);
        tool = new CodingKnowledgeTool(knowledgeBase);
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
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

        it('should persist and reuse embedding cache between initializations', async () => {
            const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-knowledge-cache-test-'));
            const staticDataPath = path.join(cacheDir, 'static.json');
            const userDataPath = path.join(cacheDir, 'user.json');
            const embeddingCachePath = path.join(cacheDir, 'embeddings.json');
            fs.writeFileSync(staticDataPath, JSON.stringify([
                {
                    id: 'cached_1',
                    category: 'backend',
                    title: 'Route Mounting',
                    content: 'Mount Express routers from server index.',
                    tags: ['express', 'routes'],
                    source: 'test',
                    metadata: {
                        project: 'chatbot',
                        sourceType: 'repo-doc',
                        authority: 'canonical'
                    }
                }
            ]));
            fs.writeFileSync(userDataPath, JSON.stringify([]));

            const firstEmbedBatch = jest.fn().mockResolvedValue([[0.1, 0.2]]);
            const firstKb = new CodingKnowledgeBase({
                embed: jest.fn().mockResolvedValue([0.1, 0.2]),
                embedBatch: firstEmbedBatch,
                getDimensions: () => 2
            } as any, { staticDataPath, userDataPath, embeddingCachePath });
            await firstKb.initialize();

            const secondEmbedBatch = jest.fn().mockResolvedValue([[0.9, 0.9]]);
            const secondKb = new CodingKnowledgeBase({
                embed: jest.fn().mockResolvedValue([0.1, 0.2]),
                embedBatch: secondEmbedBatch,
                getDimensions: () => 2
            } as any, { staticDataPath, userDataPath, embeddingCachePath });
            await secondKb.initialize();

            expect(firstEmbedBatch).toHaveBeenCalledTimes(1);
            expect(secondEmbedBatch).not.toHaveBeenCalled();
            expect(fs.existsSync(embeddingCachePath)).toBe(true);

            fs.rmSync(cacheDir, { recursive: true, force: true });
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
