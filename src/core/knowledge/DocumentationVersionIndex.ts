/**
 * Documentation Version Index (CRK-P07-T05)
 *
 * Indexes and resolves product versions, version ranges, feature introduction/removal,
 * and deprecation status to prevent version confusion in coding assistance.
 */

import { VersionIndexRecord, VersionIndexRecordInput } from '../../types/official-docs';

export interface VersionQuery {
  product: string;
  targetVersion?: string;
  majorVersion?: number;
}

export class DocumentationVersionIndex {
  private readonly records = new Map<string, VersionIndexRecord[]>();

  public addRecord(record: VersionIndexRecordInput): void {
    const key = record.product.toLowerCase();
    const existing = this.records.get(key) ?? [];
    const normalized: VersionIndexRecord = {
      ...record,
      deprecated: record.deprecated ?? false,
      isLts: record.isLts ?? false,
    };
    existing.push(normalized);
    this.records.set(key, existing);
  }

  public getRecords(product: string): VersionIndexRecord[] {
    return this.records.get(product.toLowerCase()) ?? [];
  }

  /**
   * Parse a version string (e.g., "4.3.0", "v18.2", "3") into numbers
   */
  public parseVersion(versionStr: string): { major: number; minor: number; patch: number } {
    const cleaned = versionStr.replace(/^[v^~]/, '').trim();
    const parts = cleaned.split('.').map(p => parseInt(p, 10));
    return {
      major: isNaN(parts[0]) ? 0 : parts[0],
      minor: isNaN(parts[1]) ? 0 : parts[1],
      patch: isNaN(parts[2]) ? 0 : parts[2],
    };
  }

  /**
   * Resolve best-matching version record for a product and query
   */
  public resolveVersion(query: VersionQuery): VersionIndexRecord | undefined {
    const list = this.getRecords(query.product);
    if (list.length === 0) return undefined;

    if (query.targetVersion) {
      const parsedTarget = this.parseVersion(query.targetVersion);
      // Exact or major.minor match
      const match = list.find(r =>
        r.majorVersion === parsedTarget.major &&
        (parsedTarget.minor === 0 || r.minorVersion === parsedTarget.minor)
      );
      if (match) return match;
    }

    if (query.majorVersion !== undefined) {
      const match = list.find(r => r.majorVersion === query.majorVersion && !r.deprecated);
      if (match) return match;
    }

    // Default to newest non-deprecated version
    return [...list]
      .filter(r => !r.deprecated)
      .sort((a, b) => (b.majorVersion - a.majorVersion) || (b.minorVersion - a.minorVersion))[0] ?? list[0];
  }

  /**
   * Check if an API or feature introduced/removed in versions is valid for target
   */
  public isCompatible(product: string, feature: { introducedIn?: string; removedIn?: string }, targetVersion: string): boolean {
    const target = this.parseVersion(targetVersion);

    if (feature.introducedIn) {
      const intro = this.parseVersion(feature.introducedIn);
      if (target.major < intro.major || (target.major === intro.major && target.minor < intro.minor)) {
        return false;
      }
    }

    if (feature.removedIn) {
      const removed = this.parseVersion(feature.removedIn);
      if (target.major > removed.major || (target.major === removed.major && target.minor >= removed.minor)) {
        return false;
      }
    }

    return true;
  }
}
