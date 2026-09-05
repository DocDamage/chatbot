/**
 * Section 50: Coding-Specific Retrieval Policy Types & Schemas
 */
import { z } from 'zod';

export const CodingProjectEvidenceSchema = z.object({
  language: z.string().optional(),
  framework: z.string().optional(),
  frameworkVersion: z.string().optional(),
  buildSystem: z.string().optional(),
  operatingSystem: z.string().optional(),
  compilerOrRuntime: z.string().optional(),
  repositoryOrProject: z.string().optional(),
  detectedErrorCodes: z.array(z.string()).default([]),
  evidenceSource: z.enum(['project_files', 'package_json', 'user_prompt', 'inferred']).default('inferred')
});
export type CodingProjectEvidence = z.infer<typeof CodingProjectEvidenceSchema>;

export const CodingSourceTierSchema = z.enum([
  '1_project_instructions_repository',
  '2_official_docs_compatible_version',
  '3_project_tests_diagnostics',
  '4_high_quality_developer_qa',
  '5_curated_code_examples',
  '6_broader_sources'
]);
export type CodingSourceTier = z.infer<typeof CodingSourceTierSchema>;

export interface PrioritizedCodingSource {
  tier: CodingSourceTier;
  sourceId: string;
  title: string;
  content: string;
  authority: number;
  isCurrentRepo: boolean;
}

export interface ErrorQueryExpansionInput {
  rawErrorText: string;
  errorCode?: string;
  relatedSymbol?: string;
  language?: string;
  framework?: string;
  version?: string;
  toolchain?: string;
}

export interface ExpandedErrorQuery {
  sanitizedQuery: string;
  sanitizedErrorText: string;
  errorCode?: string;
  relatedSymbol?: string;
  redactedPaths: string[];
  redactedSecrets: string[];
  onlineSafe: boolean;
}

export interface CodeAdaptationContext {
  projectStyle: string[];
  targetAPIVersions: string[];
  localTypesOrInterfaces: string[];
  testRequirements: string[];
  userRequirements: string[];
}

export interface CodeAdaptationEvaluation {
  adapted: boolean;
  adheresToProjectStyle: boolean;
  usesCurrentAPIs: boolean;
  satisfiesLocalTypes: boolean;
  passesTestCheck: boolean;
  feedback: string[];
}

export interface VerificationChecklist {
  compileOrTypecheck: { requested: boolean; available: boolean; command?: string; status: 'pending' | 'passed' | 'failed' | 'unavailable' };
  lint: { requested: boolean; available: boolean; command?: string; status: 'pending' | 'passed' | 'failed' | 'unavailable' };
  focusedTests: { requested: boolean; available: boolean; command?: string; status: 'pending' | 'passed' | 'failed' | 'unavailable' };
  projectNativeChecks: { requested: boolean; available: boolean; command?: string; status: 'pending' | 'passed' | 'failed' | 'unavailable' };
  review: { requested: boolean; available: boolean; status: 'pending' | 'completed' };
  honestReport: string;
}
