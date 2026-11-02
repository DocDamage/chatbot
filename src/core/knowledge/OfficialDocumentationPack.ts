/**
 * Official Documentation Pack (CRK-P07-T03)
 *
 * Orchestrates official documentation ingestion, semantic indexing, version compatibility,
 * and high-authority search retrieval.
 */

import {
  OfficialDocManifest,
  OfficialDocManifestInput,
  officialDocManifestSchema,
  OfficialDocChunk,
  VersionIndexRecordInput,
} from '../../types/official-docs';
import { DocumentationSourcePolicy, OFFICIAL_DOC_AUTHORITY } from './DocumentationSourcePolicy';
import { DocumentationChunker } from './DocumentationChunker';
import { DocumentationVersionIndex } from './DocumentationVersionIndex';

export interface DocSearchResult {
  chunk: OfficialDocChunk;
  authority: number;
  score: number;
  versionMatch: boolean;
}

export class OfficialDocumentationPack {
  private readonly manifests = new Map<string, OfficialDocManifest>();
  private readonly chunks = new Map<string, OfficialDocChunk[]>(); // product -> chunks
  private readonly policy: DocumentationSourcePolicy;
  private readonly chunker: DocumentationChunker;
  private readonly versionIndex: DocumentationVersionIndex;

  constructor(
    policy: DocumentationSourcePolicy = new DocumentationSourcePolicy(),
    chunker: DocumentationChunker = new DocumentationChunker(),
    versionIndex: DocumentationVersionIndex = new DocumentationVersionIndex()
  ) {
    this.policy = policy;
    this.chunker = chunker;
    this.versionIndex = versionIndex;
  }

  public registerManifest(input: OfficialDocManifestInput): void {
    const manifest = officialDocManifestSchema.parse(input);
    const product = this.policy.canonicalizeProduct(manifest.product);
    this.manifests.set(product, manifest);

    const version = this.versionIndex.parseVersion(manifest.version);
    this.versionIndex.addRecord({
      product,
      versionString: manifest.version,
      majorVersion: version.major,
      minorVersion: version.minor,
      patchVersion: version.patch,
      deprecated: false,
    });
  }

  public addVersionRecord(record: VersionIndexRecordInput): void {
    this.versionIndex.addRecord(record);
  }

  public indexMarkdownDoc(
    product: string,
    version: string,
    page: string,
    markdownContent: string
  ): OfficialDocChunk[] {
    const canonical = this.policy.canonicalizeProduct(product);
    const newChunks = this.chunker.chunkDocument({
      product: canonical,
      version,
      page,
      markdownContent,
    });

    const existing = this.chunks.get(canonical) ?? [];
    existing.push(...newChunks);
    this.chunks.set(canonical, existing);
    return newChunks;
  }

  /**
   * Search official documentation chunks with authority weighting and version affinity
   */
  public search(
    product: string,
    query: string,
    targetVersion?: string
  ): DocSearchResult[] {
    const canonical = this.policy.canonicalizeProduct(product);
    const productChunks = this.chunks.get(canonical) ?? [];
    const queryTokens = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);

    const results: DocSearchResult[] = [];

    for (const chunk of productChunks) {
      let matchCount = 0;
      const textToSearch = `${chunk.subsection} ${chunk.apiSymbols.join(' ')} ${chunk.content}`.toLowerCase();

      for (const token of queryTokens) {
        if (textToSearch.includes(token)) matchCount += 1;
      }

      if (matchCount === 0) continue;

      const versionMatch = !targetVersion || chunk.version.startsWith(targetVersion);
      // Higher score for symbol matches and version accuracy
      const symbolBoost = chunk.apiSymbols.some(s => query.toLowerCase().includes(s.toLowerCase())) ? 0.3 : 0;
      const versionMultiplier = versionMatch ? 1.0 : 0.4;
      const rawScore = (matchCount / queryTokens.length) + symbolBoost;

      const finalScore = rawScore * OFFICIAL_DOC_AUTHORITY * versionMultiplier;

      results.push({
        chunk,
        authority: OFFICIAL_DOC_AUTHORITY,
        score: finalScore,
        versionMatch,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public getManifest(product: string): OfficialDocManifest | undefined {
    return this.manifests.get(this.policy.canonicalizeProduct(product));
  }

  public getPolicy(): DocumentationSourcePolicy {
    return this.policy;
  }

  public getVersionIndex(): DocumentationVersionIndex {
    return this.versionIndex;
  }
}
