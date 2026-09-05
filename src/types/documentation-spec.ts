/**
 * Section 47: Documentation Deliverables Specification Types
 */
import { z } from 'zod';

export const DocumentationCategorySchema = z.enum([
  'architecture',
  'guides',
  'implementation',
  'runbooks'
]);
export type DocumentationCategory = z.infer<typeof DocumentationCategorySchema>;

export const RequiredDocumentationPathSchema = z.enum([
  'docs/architecture/CHAT_RUNTIME.md',
  'docs/architecture/KNOWLEDGE_PLATFORM.md',
  'docs/guides/KNOWLEDGE_PACKS.md',
  'docs/guides/CHAT_DIAGNOSTICS.md',
  'docs/guides/MODEL_POLICIES.md',
  'docs/implementation/RETRIEVAL_POLICY.md',
  'docs/implementation/DATASET_LICENSE_POLICY.md',
  'docs/implementation/EVALUATION_POLICY.md',
  'docs/implementation/DATASET_REFRESH_POLICY.md',
  'docs/runbooks/KNOWLEDGE_UPDATE_FAILURE.md',
  'docs/runbooks/RAG_DEGRADED.md',
  'docs/runbooks/MODEL_ROUTING_FAILURE.md'
]);
export type RequiredDocumentationPath = z.infer<typeof RequiredDocumentationPathSchema>;

export interface DocumentationRequirement {
  path: RequiredDocumentationPath;
  category: DocumentationCategory;
  title: string;
  minWordCount: number;
  requiredHeadings: string[];
}

export interface DocumentationAuditResult {
  path: RequiredDocumentationPath;
  exists: boolean;
  wordCount: number;
  headingsFound: string[];
  missingHeadings: string[];
  compliant: boolean;
  error?: string;
}

export interface DocumentationDeliverablesReport {
  timestamp: string;
  totalRequired: number;
  compliantCount: number;
  results: DocumentationAuditResult[];
  allCompliant: boolean;
}
