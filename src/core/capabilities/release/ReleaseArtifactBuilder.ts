/**
 * Release Artifact Builder (PX22-T03)
 * Assembles and validates the published release distribution artifacts:
 * - Server & client application bundle descriptors
 * - Desktop companion installer manifests
 * - Capability pack distribution archives & manifests
 * - SHA-256 integrity checksums
 * - CycloneDX / SPDX Software Bill of Materials (SBOM)
 * - Cryptographic provenance attestations
 * - Third-party notices and license disclosures
 * - Migration and rollback documentation
 * - Evidence & benchmark index references
 */

import { createHash } from 'crypto';

export interface PublishedReleaseArtifact {
  name: string;
  category: 'container' | 'installer' | 'pack_bundle' | 'sbom' | 'attestation' | 'docs';
  sizeBytes: number;
  sha256Checksum: string;
  downloadPath: string;
  signatureVerified: boolean;
}

export interface ReleaseDistributionPackage {
  releaseId: string;
  version: string;
  buildDate: string;
  artifacts: PublishedReleaseArtifact[];
  overallDigest: string;
  releaseNotesSummary: string;
  certificationEligible: boolean;
}

export class ReleaseArtifactBuilder {
  private static instance: ReleaseArtifactBuilder;

  public static getInstance(): ReleaseArtifactBuilder {
    if (!ReleaseArtifactBuilder.instance) {
      ReleaseArtifactBuilder.instance = new ReleaseArtifactBuilder();
    }
    return ReleaseArtifactBuilder.instance;
  }

  public generateReleasePackage(
    version: string = '1.0.0',
    artifacts: PublishedReleaseArtifact[] = []
  ): ReleaseDistributionPackage {
    const buildDate = new Date().toISOString();
    const releaseId = `rel-${version}-${buildDate.substring(0, 10)}`;

    const requiredCategories: PublishedReleaseArtifact['category'][] = [
      'container', 'installer', 'pack_bundle', 'sbom', 'attestation', 'docs'
    ];
    const certificationEligible = requiredCategories.every(category =>
      artifacts.some(artifact => artifact.category === category
        && artifact.sizeBytes > 0
        && /^[a-f0-9]{64}$/i.test(artifact.sha256Checksum)
        && artifact.signatureVerified)
    );

    const overallDigest = createHash('sha256')
      .update(JSON.stringify(artifacts))
      .digest('hex');

    return {
      releaseId,
      version,
      buildDate,
      artifacts,
      overallDigest,
      releaseNotesSummary: certificationEligible
        ? `AI ChatBot Hub v${version} release package with supplied, signed artifacts.`
        : `AI ChatBot Hub v${version} draft release package; required signed artifacts are missing.`,
      certificationEligible
    };
  }
}
