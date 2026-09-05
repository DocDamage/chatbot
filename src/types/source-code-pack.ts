/**
 * Curated Source-Code Pack Schemas & Interfaces (CRK Phase 14: CRK-P14-T01 to T09)
 */

export type WhitelistedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'java'
  | 'lua'
  | 'gdscript'
  | 'sql'
  | 'shell'
  | 'powershell'
  | 'html'
  | 'css'
  | 'dockerfile'
  | 'cmake';

export interface CodeSymbolInfo {
  name: string;
  type: 'function' | 'method' | 'class' | 'interface' | 'struct' | 'enum' | 'module';
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
}

export interface CodeRelationshipMetadata {
  imports: string[];
  exports: string[];
  relatedTypes?: string[];
  relatedTestPath?: string;
  moduleName?: string;
}

export interface CodeProvenanceMetadata {
  repository: string;
  commit: string;
  path: string;
  repoLicense: string;
  datasetLicense: string;
  sourceUrl: string;
  fileNotice?: string;
  startLine: number;
  endLine: number;
}

export interface CodeChunk {
  chunkId: string;
  language: WhitelistedLanguage;
  symbol?: CodeSymbolInfo;
  relationships: CodeRelationshipMetadata;
  provenance: CodeProvenanceMetadata;
  content: string;
  exactHash: string;
  simHash: string;
  authority: number;
}

export interface FileFilterResult {
  accepted: boolean;
  reason?: string;
  isGenerated?: boolean;
  detectedLanguage?: WhitelistedLanguage;
}

export interface RepoQualitySignals {
  declaredLicense: string;
  hasReadme: boolean;
  hasTests: boolean;
  stars?: number;
  isFork?: boolean;
  commitCount?: number;
}
