/**
 * Section 41: Proposed Repository File Map Types & Schemas
 * Governs the target structural layout of the canonical chatbot codebase.
 */
import { z } from 'zod';

export type CanonicalModuleCategory =
  | 'chat'
  | 'conversation'
  | 'workflows'
  | 'knowledge'
  | 'providers'
  | 'feedback'
  | 'evals'
  | 'governance'
  | 'migration'
  | 'observability'
  | 'types'
  | 'client'
  | 'docs';

export const CanonicalModuleCategorySchema = z.enum([
  'chat',
  'conversation',
  'workflows',
  'knowledge',
  'providers',
  'feedback',
  'evals',
  'governance',
  'migration',
  'observability',
  'types',
  'client',
  'docs',
]);

export interface CanonicalModuleRule {
  category: CanonicalModuleCategory;
  baseDirectory: string;
  allowedSubdirectories: string[];
  maxFileLines: number;
  forbiddenImports: string[];
  requiredExports?: string[];
}

export interface FileViolation {
  filePath: string;
  ruleViolated: string;
  severity: 'error' | 'warning';
  details: string;
}

export interface FileMapAuditReport {
  timestamp: string;
  totalFilesChecked: number;
  validFilesCount: number;
  violations: FileViolation[];
  compliant: boolean;
}

export const CANONICAL_MODULE_RULES: Record<CanonicalModuleCategory, CanonicalModuleRule> = {
  chat: {
    category: 'chat',
    baseDirectory: 'src/core/chat',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client', '../database'],
  },
  conversation: {
    category: 'conversation',
    baseDirectory: 'src/core/state',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  workflows: {
    category: 'workflows',
    baseDirectory: 'src/core/workflow',
    allowedSubdirectories: ['definitions', '__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  knowledge: {
    category: 'knowledge',
    baseDirectory: 'src/core/knowledge',
    allowedSubdirectories: ['adapters', '__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  providers: {
    category: 'providers',
    baseDirectory: 'src/core/providers',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  feedback: {
    category: 'feedback',
    baseDirectory: 'src/core/feedback',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  evals: {
    category: 'evals',
    baseDirectory: 'src/core/evals',
    allowedSubdirectories: ['fixtures', '__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  governance: {
    category: 'governance',
    baseDirectory: 'src/core/governance',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  migration: {
    category: 'migration',
    baseDirectory: 'src/core/migration',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  observability: {
    category: 'observability',
    baseDirectory: 'src/core/observability',
    allowedSubdirectories: ['__tests__'],
    maxFileLines: 300,
    forbiddenImports: ['../../client'],
  },
  types: {
    category: 'types',
    baseDirectory: 'src/types',
    allowedSubdirectories: [],
    maxFileLines: 300,
    forbiddenImports: ['../core', '../server', '../client'],
  },
  client: {
    category: 'client',
    baseDirectory: 'client/src',
    allowedSubdirectories: ['components', 'services', 'hooks'],
    maxFileLines: 300,
    forbiddenImports: ['src/core/database'],
  },
  docs: {
    category: 'docs',
    baseDirectory: 'docs/implementation',
    allowedSubdirectories: ['chat-runtime', 'evidence', 'handoffs'],
    maxFileLines: 10000,
    forbiddenImports: [],
  },
};
