/**
 * Academic License Policy (CRK Phase 20: CRK-P20-T01)
 *
 * Enforces implementation-time license validation for academic and scholarly corpora.
 * Rejects closed or restrictive licenses to guarantee open compliance.
 */

import { AcademicLicense } from '../../types/research-math-packs';

export interface LicenseValidationResult {
  accepted: boolean;
  license: AcademicLicense;
  isRedistributable: boolean;
  requiresAttribution: boolean;
  rejectionReason?: string;
}

export class AcademicLicensePolicy {
  private static readonly PERMISSIVE_LICENSES = new Set<AcademicLicense>([
    'CC-BY-4.0',
    'CC-BY-3.0',
    'CC-BY-SA-4.0',
    'CC0-1.0',
    'arXiv-non-exclusive',
    'OpenAccess-Permissive',
  ]);

  /**
   * Evaluates if an academic license meets open ingestion criteria (§3140-3151)
   */
  public evaluate(license: AcademicLicense): LicenseValidationResult {
    if (AcademicLicensePolicy.PERMISSIVE_LICENSES.has(license)) {
      return {
        accepted: true,
        license,
        isRedistributable: true,
        requiresAttribution: license !== 'CC0-1.0',
      };
    }

    if (license === 'proprietary-closed') {
      return {
        accepted: false,
        license,
        isRedistributable: false,
        requiresAttribution: true,
        rejectionReason: 'Proprietary closed-access research paper: ingestion strictly prohibited.',
      };
    }

    return {
      accepted: false,
      license,
      isRedistributable: false,
      requiresAttribution: true,
      rejectionReason: `Unknown or unverified academic license '${license}': open access proof required.`,
    };
  }

  public isPermissive(license: AcademicLicense): boolean {
    return AcademicLicensePolicy.PERMISSIVE_LICENSES.has(license);
  }
}
