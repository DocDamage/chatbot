/**
 * Protocol and Subsystem Version Matrix (PX22-T02)
 * Manages independent versioning and backward-compatibility windows for:
 * - Core Hub Application (SemVer)
 * - Capability Pack Manifest Schema
 * - Job & Async Event Protocol
 * - Artifact Store Metadata & Lineage Schema
 * - Engine & Media Adapter Protocols
 * - Relational Database Migrations
 * - Desktop Companion Protocol
 * - Individual Capability Packs
 */

export interface SubsystemVersionSpec {
  subsystem:
    | 'core_app'
    | 'pack_manifest_schema'
    | 'job_event_protocol'
    | 'artifact_metadata_schema'
    | 'engine_adapter_protocol'
    | 'db_schema'
    | 'desktop_companion_protocol';
  currentVersion: string;
  minimumSupportedVersion: string;
  deprecatedVersions: string[];
  migrationWindowDays: number;
}

export class ProtocolVersionMatrix {
  private static instance: ProtocolVersionMatrix;
  private matrix: Map<string, SubsystemVersionSpec> = new Map();

  constructor() {
    this.registerDefaultSpecs();
  }

  public static getInstance(): ProtocolVersionMatrix {
    if (!ProtocolVersionMatrix.instance) {
      ProtocolVersionMatrix.instance = new ProtocolVersionMatrix();
    }
    return ProtocolVersionMatrix.instance;
  }

  private registerDefaultSpecs(): void {
    const specs: SubsystemVersionSpec[] = [
      {
        subsystem: 'core_app',
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 90
      },
      {
        subsystem: 'pack_manifest_schema',
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 180
      },
      {
        subsystem: 'job_event_protocol',
        currentVersion: '1.2.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: ['0.9.0'],
        migrationWindowDays: 90
      },
      {
        subsystem: 'artifact_metadata_schema',
        currentVersion: '1.1.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 180
      },
      {
        subsystem: 'engine_adapter_protocol',
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 60
      },
      {
        subsystem: 'db_schema',
        currentVersion: '3.0.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 365
      },
      {
        subsystem: 'desktop_companion_protocol',
        currentVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        deprecatedVersions: [],
        migrationWindowDays: 90
      }
    ];

    for (const s of specs) {
      this.matrix.set(s.subsystem, s);
    }
  }

  public getSpec(subsystem: SubsystemVersionSpec['subsystem']): SubsystemVersionSpec | undefined {
    return this.matrix.get(subsystem);
  }

  public isVersionCompatible(subsystem: SubsystemVersionSpec['subsystem'], candidateVersion: string): boolean {
    const spec = this.matrix.get(subsystem);
    if (!spec) return false;

    // Reject explicitly deprecated versions
    if (spec.deprecatedVersions.includes(candidateVersion)) {
      return false;
    }

    return candidateVersion >= spec.minimumSupportedVersion;
  }

  public listSpecs(): SubsystemVersionSpec[] {
    return Array.from(this.matrix.values());
  }
}
