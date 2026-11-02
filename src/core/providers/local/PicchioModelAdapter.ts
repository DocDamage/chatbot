/**
 * Picchio External Model Adapter (PX-07 / PX07-T04)
 * Connects to separately operated Picchio local MoE (Mixture of Experts) server
 * with disk-streamed weights, strict single-request serialization, and memory reporting.
 */

import { ExternalLocalModelAdapter, ExternalLocalModelConfig } from './ExternalLocalModelAdapter';
import { LLMGenerateOptions, LLMResponse } from '../LLMAdapter';
import { logger } from '../../observability/logger';

export interface PicchioModelConfig extends ExternalLocalModelConfig {
  minimumRamMb?: number;
  minimumDiskMb?: number;
  diskStreamPath?: string;
}

export class PicchioModelAdapter extends ExternalLocalModelAdapter {
  private minimumRamMb: number;
  private minimumDiskMb: number;
  private diskStreamPath?: string;

  constructor(config: PicchioModelConfig) {
    // Picchio uses disk-streamed MoE weights and requires strict single-request concurrency (maxConcurrent: 1)
    super({
      ...config,
      providerName: config.providerName || 'picchio-moe',
      resourceBudget: {
        maxConcurrency: 1, // Strict single-request serialization
        maxQueueDepth: 5,
        ...config.resourceBudget
      }
    });

    this.minimumRamMb = config.minimumRamMb || 8192; // 8GB RAM baseline
    this.minimumDiskMb = config.minimumDiskMb || 30720; // 30GB Disk baseline
    this.diskStreamPath = config.diskStreamPath;
  }

  /**
   * Return Picchio hardware requirements and notices
   */
  public getRequirementsSummary(): {
    minimumRamMb: number;
    minimumDiskMb: number;
    diskStreamPath?: string;
    concurrencyModel: string;
    licenseNotice: string;
  } {
    return {
      minimumRamMb: this.minimumRamMb,
      minimumDiskMb: this.minimumDiskMb,
      diskStreamPath: this.diskStreamPath,
      concurrencyModel: 'serialized_single_request',
      licenseNotice:
        'Picchio is operated separately by the user. Ensure MoE checkpoint terms and licensing compliance.'
    };
  }

  public override async generate(
    options: LLMGenerateOptions,
    extraOptions: { signal?: AbortSignal; requestId?: string } = {}
  ): Promise<LLMResponse> {
    logger.info('Executing Picchio disk-streamed MoE inference', {
      model: options.model || this.getModelName(),
      serialized: true
    });
    return super.generate(options, extraOptions);
  }
}
