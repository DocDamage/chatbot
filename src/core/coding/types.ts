import { WorkMode } from '../modes/ExecutionModePolicy';

export type CodingIntent =
  | 'code_question'
  | 'debug_error'
  | 'write_feature'
  | 'modify_existing_code'
  | 'review_diff'
  | 'explain_code'
  | 'generate_tests'
  | 'refactor'
  | 'security_review'
  | 'performance_review'
  | 'dependency_help';

export interface EngineeringTask {
  taskId: string;
  intent: CodingIntent;
  languages: string[];
  frameworks: string[];
  projectRoots: string[];
  affectedFiles: string[];
  affectedSymbols: string[];
  manifests: string[];
  relatedTests: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  mode: WorkMode;
}

export interface Diagnostic {
  tool: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  message: string;
  raw: string;
}

export interface VerificationResult {
  command: string;
  argv: string[];
  exitCode: number | null;
  durationMs: number;
  diagnostics: Diagnostic[];
  stdout: string;
  stderr: string;
  status: 'passed' | 'failed' | 'timed_out' | 'blocked' | 'skipped';
}

export interface ContextEvidence {
  kind: 'request' | 'instruction' | 'architecture' | 'source' | 'symbol' | 'test' | 'dependency' | 'diff' | 'diagnostic' | 'documentation';
  label: string;
  content: string;
  path?: string;
  line?: number;
  authority: 'repository' | 'official' | 'curated' | 'learned' | 'user';
  reason: string;
  confidence: number;
}

export interface EditOperation {
  operation: 'create' | 'modify' | 'delete';
  path: string;
  content?: string;
  expectedHash?: string;
  expectedContent?: string;
  reason: string;
  authorized: boolean;
}

export interface StructuredPatch {
  operations: EditOperation[];
  diff: string;
  filesChanged: string[];
  conflicts: Array<{ path: string; reason: string }>;
  applied: boolean;
}
