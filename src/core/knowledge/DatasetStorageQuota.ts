/**
 * Dataset Storage Quota (CRK-P06-T08)
 *
 * Enforces configurable storage limits and prevents disk exhaustion
 * before dataset downloads or index builds take place.
 */

import { EstimatedResources } from '../../types/knowledge-datasets';

export interface StorageQuotaConfig {
  maxDownloadGb: number;
  maxIndexGb: number;
  maxDatasetGb: number;
  minFreeDiskGb: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  violations: string[];
  metrics: {
    estimatedDownloadGb: number;
    estimatedIndexGb: number;
    estimatedTotalGb: number;
    simulatedFreeDiskGb: number;
  };
}

export class DatasetStorageQuota {
  private readonly config: StorageQuotaConfig;

  constructor(config?: Partial<StorageQuotaConfig>) {
    this.config = {
      maxDownloadGb: config?.maxDownloadGb ?? Number(process.env.KNOWLEDGE_MAX_DOWNLOAD_GB || 50),
      maxIndexGb: config?.maxIndexGb ?? Number(process.env.KNOWLEDGE_MAX_INDEX_GB || 100),
      maxDatasetGb: config?.maxDatasetGb ?? Number(process.env.KNOWLEDGE_MAX_DATASET_GB || 10),
      minFreeDiskGb: config?.minFreeDiskGb ?? Number(process.env.KNOWLEDGE_MIN_FREE_DISK_GB || 5),
    };
  }

  public evaluate(
    estimates?: EstimatedResources,
    simulatedFreeDiskGb = 50
  ): QuotaCheckResult {
    const violations: string[] = [];
    const BYTES_PER_GB = 1024 * 1024 * 1024;

    const downloadBytes = estimates?.downloadBytes || 0;
    const indexedBytes = estimates?.indexedBytes || 0;

    const estimatedDownloadGb = downloadBytes / BYTES_PER_GB;
    const estimatedIndexGb = indexedBytes / BYTES_PER_GB;
    const estimatedTotalGb = estimatedDownloadGb + estimatedIndexGb;

    // 1. Single dataset size limit
    if (estimatedTotalGb > this.config.maxDatasetGb) {
      violations.push(
        `Dataset estimated size (${estimatedTotalGb.toFixed(2)} GB) exceeds MAX_DATASET limit of ${this.config.maxDatasetGb} GB`
      );
    }

    // 2. Download limit
    if (estimatedDownloadGb > this.config.maxDownloadGb) {
      violations.push(
        `Dataset download size (${estimatedDownloadGb.toFixed(2)} GB) exceeds MAX_DOWNLOAD limit of ${this.config.maxDownloadGb} GB`
      );
    }

    // 3. Index limit
    if (estimatedIndexGb > this.config.maxIndexGb) {
      violations.push(
        `Dataset indexed size (${estimatedIndexGb.toFixed(2)} GB) exceeds MAX_INDEX limit of ${this.config.maxIndexGb} GB`
      );
    }

    // 4. Free disk headroom limit (§1586)
    const remainingFreeDisk = simulatedFreeDiskGb - estimatedTotalGb;
    if (remainingFreeDisk < this.config.minFreeDiskGb) {
      violations.push(
        `Insufficient free disk space: operation would leave ${remainingFreeDisk.toFixed(2)} GB free, which is below the minimum reserve of ${this.config.minFreeDiskGb} GB`
      );
    }

    return {
      allowed: violations.length === 0,
      violations,
      metrics: {
        estimatedDownloadGb,
        estimatedIndexGb,
        estimatedTotalGb,
        simulatedFreeDiskGb,
      },
    };
  }

  public getConfig(): StorageQuotaConfig {
    return { ...this.config };
  }
}
