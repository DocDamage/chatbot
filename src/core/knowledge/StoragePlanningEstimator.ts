import {
  InstallPresetTier,
  PackStorageProfile,
  StorageEstimateBreakdown,
  PresetPlan,
  DiskHeadroomCheck,
} from '../../types/storage-planning';

export class StoragePlanningEstimator {
  private static readonly FLOAT32_BYTES_PER_DIMENSION = 4;
  private static readonly DEFAULT_INDEX_OVERHEAD_RATIO = 0.20; // 20% HNSW / graph overhead
  private static readonly SAFETY_HEADROOM_MULTIPLIER = 2.0;   // 2x footprint required during processing

  public static readonly CANONICAL_PACK_PROFILES: Record<string, PackStorageProfile> = {
    official_docs: {
      packId: 'official_docs',
      name: 'Official Documentation Pack',
      documentCount: 5000,
      chunkCount: 25000,
      avgChunkTextBytes: 600,
      embeddingDimensions: 768,
      downloadCompressedBytes: 15_000_000, // ~15 MB
    },
    developer_qa: {
      packId: 'developer_qa',
      name: 'Developer Q&A Pack',
      documentCount: 20000,
      chunkCount: 60000,
      avgChunkTextBytes: 800,
      embeddingDimensions: 768,
      downloadCompressedBytes: 40_000_000, // ~40 MB
    },
    curated_code: {
      packId: 'curated_code',
      name: 'Curated Source-Code Pack',
      documentCount: 10000,
      chunkCount: 40000,
      avgChunkTextBytes: 700,
      embeddingDimensions: 768,
      downloadCompressedBytes: 30_000_000, // ~30 MB
    },
    general_knowledge: {
      packId: 'general_knowledge',
      name: 'General Knowledge (Wikipedia/Wikidata)',
      documentCount: 50000,
      chunkCount: 150000,
      avgChunkTextBytes: 650,
      embeddingDimensions: 768,
      downloadCompressedBytes: 100_000_000, // ~100 MB
    },
    research_papers: {
      packId: 'research_papers',
      name: 'Research Paper Pack',
      documentCount: 8000,
      chunkCount: 50000,
      avgChunkTextBytes: 900,
      embeddingDimensions: 768,
      downloadCompressedBytes: 50_000_000, // ~50 MB
    },
    math_proofs: {
      packId: 'math_proofs',
      name: 'Mathematics Reference Pack',
      documentCount: 3000,
      chunkCount: 15000,
      avgChunkTextBytes: 500,
      embeddingDimensions: 768,
      downloadCompressedBytes: 10_000_000, // ~10 MB
    },
    educational_web: {
      packId: 'educational_web',
      name: 'Filtered Educational Web Pack',
      documentCount: 30000,
      chunkCount: 100000,
      avgChunkTextBytes: 750,
      embeddingDimensions: 768,
      downloadCompressedBytes: 75_000_000, // ~75 MB
    },
  };

  /**
   * Calculates exact raw float32 vector sizing per §54.1:
   * raw vector bytes ≈ vector_count × dimensions × 4
   */
  public calculateRawVectorBytes(vectorCount: number, dimensions: number): number {
    return vectorCount * dimensions * StoragePlanningEstimator.FLOAT32_BYTES_PER_DIMENSION;
  }

  public estimatePack(profile: PackStorageProfile): StorageEstimateBreakdown {
    const rawVectorBytes = this.calculateRawVectorBytes(
      profile.chunkCount,
      profile.embeddingDimensions
    );
    const normalizedTextBytes = profile.chunkCount * profile.avgChunkTextBytes;
    const indexOverheadBytes = Math.round(
      rawVectorBytes * StoragePlanningEstimator.DEFAULT_INDEX_OVERHEAD_RATIO
    );
    const totalFootprintBytes = normalizedTextBytes + rawVectorBytes + indexOverheadBytes;
    const minimumFreeDiskBytes = Math.round(
      totalFootprintBytes * StoragePlanningEstimator.SAFETY_HEADROOM_MULTIPLIER +
        profile.downloadCompressedBytes
    );

    return {
      downloadBytes: profile.downloadCompressedBytes,
      normalizedTextBytes,
      rawVectorBytes,
      indexOverheadBytes,
      totalFootprintBytes,
      minimumFreeDiskBytes,
    };
  }

  public aggregateBreakdowns(breakdowns: StorageEstimateBreakdown[]): StorageEstimateBreakdown {
    return breakdowns.reduce(
      (acc, b) => ({
        downloadBytes: acc.downloadBytes + b.downloadBytes,
        normalizedTextBytes: acc.normalizedTextBytes + b.normalizedTextBytes,
        rawVectorBytes: acc.rawVectorBytes + b.rawVectorBytes,
        indexOverheadBytes: acc.indexOverheadBytes + b.indexOverheadBytes,
        totalFootprintBytes: acc.totalFootprintBytes + b.totalFootprintBytes,
        minimumFreeDiskBytes: acc.minimumFreeDiskBytes + b.minimumFreeDiskBytes,
      }),
      {
        downloadBytes: 0,
        normalizedTextBytes: 0,
        rawVectorBytes: 0,
        indexOverheadBytes: 0,
        totalFootprintBytes: 0,
        minimumFreeDiskBytes: 0,
      }
    );
  }

  public getPresetPlan(preset: InstallPresetTier, customPackIds?: string[]): PresetPlan {
    let packIds: string[] = [];
    let description = '';

    switch (preset) {
      case 'Lite':
        packIds = ['official_docs'];
        description = 'Official documentation only';
        break;
      case 'Developer':
        packIds = ['official_docs', 'developer_qa', 'curated_code'];
        description = 'Official docs + developer Q&A + curated code';
        break;
      case 'Research':
        packIds = ['general_knowledge', 'research_papers', 'math_proofs'];
        description = 'General encyclopedia + research + math';
        break;
      case 'Extended':
        packIds = [
          'official_docs',
          'developer_qa',
          'curated_code',
          'general_knowledge',
          'research_papers',
          'math_proofs',
          'educational_web',
        ];
        description = 'Full suite including optional educational web';
        break;
      case 'Custom':
      default:
        packIds = customPackIds ?? ['official_docs'];
        description = 'User-selected custom knowledge packs';
        break;
    }

    const breakdowns = packIds
      .map((id) => StoragePlanningEstimator.CANONICAL_PACK_PROFILES[id])
      .filter((p): p is PackStorageProfile => p !== undefined)
      .map((p) => this.estimatePack(p));

    const aggregated = this.aggregateBreakdowns(breakdowns);

    return {
      preset,
      description,
      includedPackIds: packIds,
      breakdown: aggregated,
      indiscriminateEmbeddingAllowed: false, // Strict invariant (§54)
    };
  }

  public verifyDiskHeadroom(
    availableDiskBytes: number,
    requiredMinimumBytes: number
  ): DiskHeadroomCheck {
    const hasSufficientSpace = availableDiskBytes >= requiredMinimumBytes;
    const shortfallBytes = hasSufficientSpace ? 0 : requiredMinimumBytes - availableDiskBytes;

    let warning: string | undefined;
    if (!hasSufficientSpace) {
      const neededMB = (shortfallBytes / (1024 * 1024)).toFixed(1);
      warning = `Insufficient disk headroom: Need ${neededMB} MB more free space to safely install and index without corruption.`;
    }

    return {
      availableDiskBytes,
      requiredBytes: requiredMinimumBytes,
      hasSufficientSpace,
      shortfallBytes,
      warning,
    };
  }
}
