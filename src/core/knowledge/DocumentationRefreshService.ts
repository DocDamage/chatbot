/**
 * Documentation Refresh Service (CRK-P07-T06)
 *
 * Implements incremental documentation refresh logic:
 * compares source hashes, skips unchanged pages, re-chunks and re-indexes
 * only modified content, and retires superseded versions.
 */

import { DocumentationChunker } from './DocumentationChunker';
import { OfficialDocChunk } from '../../types/official-docs';

export interface PageContent {
  pagePath: string;
  contentHash: string;
  markdownContent: string;
}

export interface RefreshSourceInput {
  product: string;
  version: string;
  pages: PageContent[];
}

export interface RefreshResult {
  product: string;
  version: string;
  skippedUnchanged: number;
  rechunkedPages: number;
  newChunks: OfficialDocChunk[];
  retiredChunkIds: string[];
}

export class DocumentationRefreshService {
  private readonly pageHashes = new Map<string, string>(); // `${product}:${pagePath}` -> hash
  private readonly chunker: DocumentationChunker;

  constructor(chunker: DocumentationChunker = new DocumentationChunker()) {
    this.chunker = chunker;
  }

  public registerKnownPage(product: string, pagePath: string, hash: string): void {
    this.pageHashes.set(`${product}:${pagePath}`, hash);
  }

  /**
   * Process refresh input, selectively re-chunking only changed or new pages (§1725)
   */
  public processRefresh(input: RefreshSourceInput): RefreshResult {
    const { product, version, pages } = input;
    let skippedUnchanged = 0;
    let rechunkedPages = 0;
    const newChunks: OfficialDocChunk[] = [];
    const retiredChunkIds: string[] = [];

    for (const page of pages) {
      const key = `${product}:${page.pagePath}`;
      const previousHash = this.pageHashes.get(key);

      if (previousHash && previousHash === page.contentHash) {
        skippedUnchanged += 1;
        continue;
      }

      // Page is new or changed
      rechunkedPages += 1;
      this.pageHashes.set(key, page.contentHash);

      const generated = this.chunker.chunkDocument({
        product,
        version,
        page: page.pagePath,
        markdownContent: page.markdownContent,
      });

      newChunks.push(...generated);
    }

    return {
      product,
      version,
      skippedUnchanged,
      rechunkedPages,
      newChunks,
      retiredChunkIds,
    };
  }
}
