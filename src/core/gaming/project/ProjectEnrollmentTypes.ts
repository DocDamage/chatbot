import { EngineKind, InstalledRuntime } from './EngineVersions';
import { AppError } from '../../../utils/errors';

export class ProjectEnrollmentError extends AppError {
  constructor(code: string, message: string, status = 409) { super(message, status, code); }
}

export interface RuntimeCandidate {
  engine: 'godot' | 'unity' | 'unreal';
  executablePath: string;
  associations?: string[];
}

export interface EnrolledRuntime extends InstalledRuntime {
  executablePath: string;
  associations: string[];
  observedAt: string;
  versionSource: 'executable-stdout' | 'file-version-resource';
  versionOutput: string;
  buildMetadata?: string;
  buildMetadataPath?: string;
  buildMetadataSha256?: string;
}

export interface ProfileBlocker { code: string; message: string }
export interface RuntimeInventory {
  runtimes: EnrolledRuntime[];
  blockers: ProfileBlocker[];
}

export interface ProjectFacts {
  engine: EngineKind;
  descriptors: Record<string, string>;
  projectVersion: string | null;
  association: string | null;
  features: string[];
  language: string;
  languageEvidence: { source: string; confidence: 'inferred' | 'observed' };
  renderer: string | null;
  buildTarget: string | null;
  packages: unknown;
  unknowns: string[];
}

export interface ProjectProfile {
  schemaVersion: 1;
  facts: ProjectFacts;
  runtime: EnrolledRuntime | null;
  resolution: 'resolved' | 'blocked';
  blockers: ProfileBlocker[];
  /** Reusable compatibility facets only; never owners, roots or project/snapshot IDs. */
  targetId: string | null;
  profileDigest: string;
  observedAt: string;
  selection: ProfileSelection;
}

export interface ProjectIdentity {
  canonicalRoot: string;
  filesystemIdentity: string;
  physicalKey: string;
}

export interface EnrolledProject extends ProjectIdentity {
  projectId: string;
  ownerId: string;
  tenantId: string;
  profile: ProjectProfile;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOwner { ownerId: string; tenantId: string }
export interface ProfileSelection {
  selectedRuntimeId?: string;
  expectedVersion?: string;
  expectedBuildDigest?: string;
}
