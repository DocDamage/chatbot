/**
 * Dataset License Policy (CRK-P06-T07)
 *
 * Enforces legal compliance, attribution tracking, and redistribution validation
 * for knowledge datasets prior to ingestion.
 */

import { DatasetLicense } from '../../types/knowledge-datasets';

export interface LicenseEvaluationResult {
  allowed: boolean;
  requiresAttribution: boolean;
  redistributable: boolean;
  violations: string[];
  reasons: string[];
}

export interface LicensePolicyOptions {
  allowNonRedistributable?: boolean;
  allowUnknownLicense?: boolean;
  restrictedLicenses?: string[];
}

export class DatasetLicensePolicy {
  private static readonly PERMISSIVE_LICENSES = new Set([
    'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense', 'CC-BY-4.0'
  ]);

  private readonly options: LicensePolicyOptions;

  constructor(options: LicensePolicyOptions = {}) {
    this.options = {
      allowNonRedistributable: false,
      allowUnknownLicense: false,
      restrictedLicenses: ['PROPRIETARY', 'ALL-RIGHTS-RESERVED', 'COMMERCIAL-RESTRICTED'],
      ...options,
    };
  }

  public evaluate(license: DatasetLicense): LicenseEvaluationResult {
    const violations: string[] = [];
    const reasons: string[] = [];
    const normId = license.id.trim().toUpperCase();

    // 1. Check explicit restricted licenses
    if (this.options.restrictedLicenses?.some(r => r.toUpperCase() === normId)) {
      violations.push(`License '${license.id}' is explicitly blacklisted by policy`);
    }

    // 2. Check redistribution requirement (§1564)
    const isRedistributable = license.redistributable === true;
    if (!isRedistributable && !this.options.allowNonRedistributable) {
      violations.push(`License '${license.id}' is not redistributable`);
    }

    // 3. Check unknown license state (§1566)
    if (license.redistributable === 'unknown' && !this.options.allowUnknownLicense) {
      violations.push(`License '${license.id}' has unknown redistribution status`);
    }

    // 4. Attribution requirement tracking (§1563)
    const requiresAttribution = Boolean(license.attributionRequired);
    if (requiresAttribution) {
      reasons.push(`Attribution is mandatory under '${license.id}'. Metadata must be preserved.`);
    }

    if (DatasetLicensePolicy.PERMISSIVE_LICENSES.has(license.id)) {
      reasons.push(`License '${license.id}' is recognized as permissive standard`);
    }

    const allowed = violations.length === 0;

    return {
      allowed,
      requiresAttribution,
      redistributable: isRedistributable,
      violations,
      reasons,
    };
  }
}
