import * as crypto from 'crypto';

export interface PackSupplyChainManifest {
  packId: string;
  version: string;
  authorSignature?: string;
  manifestSha256: string;
  sourceRepository: string;
  commitSha: string;
  license: string;
  dependencies: Array<{
    name: string;
    version: string;
    license: string;
    knownVulnerabilitiesCount: number;
  }>;
  declaredPermissions: string[];
}

export interface SupplyChainValidationResult {
  isValid: boolean;
  quarantineRequired: boolean;
  issues: string[];
  computedHash: string;
}

export class PackSupplyChainGuard {
  private static readonly DISALLOWED_LICENSES = ['AGPL-3.0', 'GPL-3.0', 'NON_COMMERCIAL', 'PROPRIETARY_UNLICENSED'];
  private static readonly DANGEROUS_PERMISSIONS = [
    'admin.capability.manage',
    'process.execute.unrestricted',
    'filesystem.write.root',
    'network.egress.unrestricted'
  ];

  public static validatePackManifest(
    manifest: PackSupplyChainManifest,
    rawContent: string
  ): SupplyChainValidationResult {
    const issues: string[] = [];
    let quarantineRequired = false;

    // 1. Check SHA256 integrity
    const computedHash = crypto.createHash('sha256').update(rawContent).digest('hex');
    if (computedHash !== manifest.manifestSha256) {
      issues.push(`Manifest integrity hash mismatch. Declared: ${manifest.manifestSha256}, Computed: ${computedHash}`);
    }

    // 2. License check
    if (this.DISALLOWED_LICENSES.includes(manifest.license.toUpperCase())) {
      issues.push(`Disallowed or incompatible license detected: ${manifest.license}`);
    }

    // 3. Dependency vulnerability check (SBOM scan)
    for (const dep of manifest.dependencies) {
      if (dep.knownVulnerabilitiesCount > 0) {
        issues.push(`Dependency ${dep.name}@${dep.version} has ${dep.knownVulnerabilitiesCount} known vulnerabilities.`);
        quarantineRequired = true;
      }
    }

    // 4. Excessive permission check
    for (const perm of manifest.declaredPermissions) {
      if (this.DANGEROUS_PERMISSIONS.includes(perm)) {
        issues.push(`Pack requests high-risk permission: ${perm}. Explicit administrative override required.`);
        quarantineRequired = true;
      }
    }

    return {
      isValid: issues.length === 0,
      quarantineRequired,
      issues,
      computedHash
    };
  }
}
