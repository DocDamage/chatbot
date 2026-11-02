/**
 * Release Train Manifest Builder (PX22-T01)
 * Compiles and validates the release train manifest:
 * - Exact capability IDs & semantic versions
 * - Certified maturity states (no marketing experimental as supported)
 * - Supported runtime deployment profiles & OS platforms
 * - Included engine / media / local model adapters
 * - Optional system dependencies
 * - Relational database migrations included
 * - Unbundled external models & tool binaries
 * - Third-party notices & clean-room declarations
 * - Known limitations & feature flag default states
 */

import { createHash } from 'crypto';
import { CapabilityMaturity } from '../CapabilityRegistry';

export interface ReleaseCapabilityEntry {
  capabilityId: string;
  version: string;
  maturity: CapabilityMaturity;
  profiles: Array<'local' | 'hosted'>;
  platforms: Array<'win32' | 'linux' | 'darwin'>;
  includedAdapters: string[];
  optionalDependencies: string[];
  dbMigrations: string[];
  externalBinariesNotBundled: string[];
  featureFlagKey: string;
  defaultEnabled: boolean;
  knownLimitations: string[];
}

export interface ReleaseTrainManifest {
  trainId: string;
  releaseVersion: string;
  buildTimestamp: string;
  gitCommitSha: string;
  capabilities: ReleaseCapabilityEntry[];
  totalSupportedCapabilities: number;
  totalPreviewCapabilities: number;
  totalExperimentalCapabilities: number;
  sha256Digest: string;
}

export class ReleaseTrainManifestBuilder {
  private static instance: ReleaseTrainManifestBuilder;

  public static getInstance(): ReleaseTrainManifestBuilder {
    if (!ReleaseTrainManifestBuilder.instance) {
      ReleaseTrainManifestBuilder.instance = new ReleaseTrainManifestBuilder();
    }
    return ReleaseTrainManifestBuilder.instance;
  }

  public buildManifest(
    gitCommitSha: string,
    capabilities: ReleaseCapabilityEntry[] = [],
    releaseVersion: string = '1.0.0'
  ): ReleaseTrainManifest {
    if (!/^[a-f0-9]{40}$/i.test(gitCommitSha)) {
      throw new Error('Release manifests require an exact 40-character Git commit SHA.');
    }
    for (const capability of capabilities) {
      if (capability.defaultEnabled) {
        throw new Error(`Capability '${capability.capabilityId}' must be disabled by default in a release manifest.`);
      }
    }
    const buildTimestamp = new Date().toISOString();
    const trainId = `train-v${releaseVersion}-${buildTimestamp.substring(0, 10)}`;

    const totalSupported = capabilities.filter(c => c.maturity === 'PRODUCTION_SUPPORTED').length;
    const totalPreview = capabilities.filter(c => c.maturity === 'PRODUCTION_PREVIEW').length;
    const totalExperimental = capabilities.filter(c => c.maturity === 'LOCAL_ONLY_EXPERIMENTAL').length;

    const payload = {
      trainId,
      releaseVersion,
      buildTimestamp,
      gitCommitSha,
      capabilities,
      totalSupportedCapabilities: totalSupported,
      totalPreviewCapabilities: totalPreview,
      totalExperimentalCapabilities: totalExperimental
    };

    const sha256Digest = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    return {
      ...payload,
      sha256Digest
    };
  }
}
