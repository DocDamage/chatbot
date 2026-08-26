/**
 * Phase PX-17: Developer Utility Pack
 * Type Definitions & Contracts
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'uuid'
  | 'object'
  | 'array'
  | 'enum';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  enumValues?: string[];
  defaultValue?: any;
  referenceCollection?: string; // Foreign Key relationship
  referenceField?: string;
}

export interface CollectionSchema {
  name: string;
  displayName?: string;
  description?: string;
  primaryKey: string;
  fields: FieldDefinition[];
  seedCount?: number;
}

export interface MockApiCollectionRecord {
  [key: string]: any;
}

export interface MockApiCollectionData {
  name: string;
  schema: CollectionSchema;
  records: MockApiCollectionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface MockApiStore {
  projectId: string;
  collections: MockApiCollectionData[];
  seed: number;
  updatedAt: string;
}

export interface ChaosSimulationConfig {
  enabled: boolean;
  latencyMs: { min: number; max: number };
  errorRate: number; // 0.0 to 1.0 (e.g. 0.1 = 10% errors)
  errorStatusCodes: number[]; // [500, 503, 429]
  rateLimit: {
    enabled: boolean;
    maxRequestsPerWindow: number;
    windowMs: number;
  };
}

export type ScenarioPreset = 'HAPPY_PATH' | 'SLOW_3G' | 'INTERMITTENT_503' | 'RATE_LIMITED' | 'CHAOS_MONKEY';

export interface RequestAuditRecord {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  latencyMs: number;
  errorInjected?: boolean;
  clientIp?: string;
}

export interface OpenApiImportResult {
  title: string;
  version: string;
  collections: CollectionSchema[];
  generatedRoutes: Array<{
    method: string;
    path: string;
    summary?: string;
    collectionName: string;
  }>;
  sourceDigest: string; // SHA-256
  warnings: string[];
}

export interface SourceDocumentReference {
  documentName: string;
  sourceDigest: string; // SHA-256
  sourceExcerpt?: string;
  pageOrChapter?: string;
}

export interface SkillChapter {
  id: string;
  title: string;
  content: string;
  sourceReferences: SourceDocumentReference[];
}

export interface SkillExportBundle {
  skillId: string;
  displayName: string;
  version: string;
  description: string;
  sourceDigests: Record<string, string>;
  skillMarkdown: string; // SKILL.md
  chapters: SkillChapter[];
  glossary: Array<{ term: string; definition: string; source: string }>;
  cheatsheet: string;
  exportedAt: string;
}

export interface PackScaffoldOptions {
  packId: string;
  displayName: string;
  description: string;
  author: string;
  maturity?: 'disabled' | 'experimental' | 'preview';
  supportedProfiles?: Array<'HOSTED' | 'LOCAL_TRUSTED'>;
  includeSkill?: boolean;
  includeAgentRole?: boolean;
  includeGoldenTask?: boolean;
}

export interface ProjectDoctorDiagnosticItem {
  id: string;
  category: 'CONFIG' | 'ROUTES' | 'TESTS' | 'SECURITY' | 'ARTIFACTS' | 'CERTIFICATION';
  severity: 'PASS' | 'WARN' | 'FAIL';
  title: string;
  details: string;
  recommendedAction?: string;
}

export interface ProjectDoctorReport {
  score: number; // 0-100
  status: 'HEALTHY' | 'ACTION_REQUIRED' | 'CRITICAL';
  timestamp: string;
  diagnostics: ProjectDoctorDiagnosticItem[];
  rankedNextActions: Array<{
    rank: number;
    action: string;
    reason: string;
    targetComponent: string;
  }>;
}
