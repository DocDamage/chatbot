import { DocumentManager } from './DocumentManager';

describe('DocumentManager entity linking integration', () => {
  it('persists entity links for added text chunks', async () => {
    const ragService = { addDocuments: jest.fn() } as any;
    const embeddingService = undefined;
    const documentStore = {
      saveChunks: jest.fn().mockResolvedValue(undefined)
    } as any;
    const entityLinkingService = {
      linkAndPersist: jest.fn().mockResolvedValue({ entities: [] })
    } as any;

    const manager = new DocumentManager(ragService, embeddingService, documentStore, entityLinkingService);
    await manager.addText('Use FL Studio with a knowledge graph.', { source: 'test.md' }, { generateEmbeddings: false });

    expect(documentStore.saveChunks).toHaveBeenCalled();
    expect(entityLinkingService.linkAndPersist).toHaveBeenCalled();
    expect(entityLinkingService.linkAndPersist.mock.calls[0][0]).toContain('FL Studio');
  });
});
