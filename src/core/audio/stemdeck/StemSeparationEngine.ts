/**
 * Stem Separation Engine (PX11-T04)
 *
 * Coordinates 4-stem and 6-stem extraction, backing/complement track creation,
 * and machine-separation confidence disclaimers.
 */

import { DemucsWorkerAdapter } from './DemucsWorkerAdapter';
import { DemucsWorkerConfig, StemArtifact, StemType } from './StemdeckTypes';

export interface SeparationResult {
  success: boolean;
  modelUsed: string;
  stems: StemArtifact[];
  backingTrack?: StemArtifact;
  confidenceDisclaimer: string;
  error?: string;
}

export class StemSeparationEngine {
  private workerAdapter: DemucsWorkerAdapter;

  constructor(workerAdapter = new DemucsWorkerAdapter()) {
    this.workerAdapter = workerAdapter;
  }

  /**
   * Separates an audio track into stems with optional backing track complement.
   */
  public async separateTrack(
    jobId: string,
    sourceAudioPath: string,
    options: {
      modelName?: 'htdemucs' | 'htdemucs_6s' | 'htdemucs_ft' | 'mdx_extra';
      stems?: StemType[];
      generateBackingTrack?: boolean;
      device?: 'auto' | 'cuda' | 'mps' | 'cpu';
    } = {}
  ): Promise<SeparationResult> {
    const defaultStems: StemType[] = ['vocals', 'drums', 'bass', 'other'];
    const requestedStems: StemType[] = options.stems && options.stems.length > 0
      ? options.stems
      : defaultStems;

    const config: DemucsWorkerConfig = {
      modelName: options.modelName || (requestedStems.length > 4 ? 'htdemucs_6s' : 'htdemucs'),
      stems: requestedStems,
      device: options.device || 'auto',
      twoStems: options.generateBackingTrack ? 'vocals' : undefined
    };

    try {
      const artifacts = await this.workerAdapter.separateStems(jobId, sourceAudioPath, config);

      const stemArtifacts = artifacts.filter(a => a.stemType !== 'complement');
      const backingTrack = artifacts.find(a => a.stemType === 'complement');

      const confidenceDisclaimer =
        'Machine-separated stems are AI estimates derived from deep neural spectrogram de-mixing. ' +
        'Artifacts or bleeding may be present in dense passages and do not represent studio-isolated multitrack master recordings.';

      return {
        success: true,
        modelUsed: config.modelName,
        stems: stemArtifacts,
        backingTrack,
        confidenceDisclaimer
      };
    } catch (err: any) {
      return {
        success: false,
        modelUsed: config.modelName,
        stems: [],
        confidenceDisclaimer: '',
        error: err.message || String(err)
      };
    }
  }

  public cancelSeparation(jobId: string): boolean {
    return this.workerAdapter.cancelJob(jobId);
  }
}
